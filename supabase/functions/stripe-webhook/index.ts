import Stripe from "npm:stripe@20.0.0";
import {createClient} from "npm:@supabase/supabase-js@2.76.1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(req)=>{
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  const key=Deno.env.get("STRIPE_SECRET_KEY"),signing=Deno.env.get("STRIPE_WEBHOOK_SECRET"),url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!key||!signing||!url||!service)return new Response("Webhook is not configured",{status:503});
  const stripe=new Stripe(key);
  let event:Stripe.Event;
  try{
    event=await stripe.webhooks.constructEventAsync(await req.text(),req.headers.get("stripe-signature")||"",signing,undefined,Stripe.createSubtleCryptoProvider());
  }catch(e){console.error("Stripe signature verification failed",e);return new Response("Invalid signature",{status:400});}
  const db=createClient(url,service);
  const {data:processed,error:readError}=await db.from("stripe_webhook_events").select("event_id").eq("event_id",event.id).maybeSingle();
  if(readError)return new Response("Database unavailable",{status:500});
  if(processed)return new Response("Already processed");
  try{
    let id:string|null=null;
    if(event.type==="checkout.session.completed"){
      const obj=event.data.object as Stripe.Checkout.Session;
      id=typeof obj.subscription==="string"?obj.subscription:obj.subscription?.id||null;
    }
    if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type))
      id=(event.data.object as Stripe.Subscription).id;
    if(id){
      // Retrieve authoritative current Stripe state rather than trusting event ordering.
      const s=await stripe.subscriptions.retrieve(id);
      const userId=s.metadata.batchsave_user_id;
      if(!userId||!UUID.test(userId))throw Error("Subscription does not contain a valid user mapping");
      const customerId=typeof s.customer==="string"?s.customer:s.customer.id;
      const {data:profile,error:pErr}=await db.from("profiles").select("id,stripe_customer_id,trial_consumed_at").eq("id",userId).single();
      if(pErr||!profile)throw Error("Unknown user mapping");
      if(profile.stripe_customer_id&&profile.stripe_customer_id!==customerId)throw Error("Customer mismatch");
      const trialEnd=s.trial_end?new Date(s.trial_end*1000).toISOString():null;
      const period=(s as unknown as {current_period_end?:number,items?:{data?:Array<{current_period_end?:number}>}}).current_period_end||
         (s as unknown as {items?:{data?:Array<{current_period_end?:number}>}}).items?.data?.[0]?.current_period_end;
      const {error:subErr}=await db.from("subscriptions").upsert({
        stripe_subscription_id:s.id,user_id:userId,stripe_customer_id:customerId,
        status:s.status,current_period_end:period?new Date(period*1000).toISOString():null,
        trial_end:trialEnd,cancel_at_period_end:s.cancel_at_period_end,updated_at:new Date().toISOString()
      },{onConflict:"stripe_subscription_id"});
      if(subErr)throw subErr;
      const updates:Record<string,string>={stripe_customer_id:customerId};
      if(s.trial_start&&!profile.trial_consumed_at)updates.trial_consumed_at=new Date(s.trial_start*1000).toISOString();
      const {error:uErr}=await db.from("profiles").update(updates).eq("id",userId);
      if(uErr)throw uErr;
    }
    const {error:markErr}=await db.from("stripe_webhook_events").insert({event_id:event.id});
    if(markErr&&markErr.code!=="23505")throw markErr;
    return new Response("ok");
  }catch(e){console.error("Stripe webhook failed",e);return new Response("Retry later",{status:500});}
});