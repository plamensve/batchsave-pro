import Stripe from "npm:stripe@20.0.0";
import {createClient} from "npm:@supabase/supabase-js@2.76.1";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"OPTIONS,POST,GET"};
const json=(data,status=200)=>Response.json(data,{status,headers:cors});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method==="GET")return new Response("You can return to BatchSave Pro and refresh the extension to see your subscription status.",{headers:{"content-type":"text/plain;charset=utf-8"}});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const base=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),secret=Deno.env.get("STRIPE_SECRET_KEY"),price=Deno.env.get("STRIPE_PRICE_ID");
  if(!base||!anon||!service||!secret||!price)return json({error:"Stripe test credentials are not configured yet"},503);
  const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  const auth=createClient(base,anon);
  const {data:{user},error:authError}=await auth.auth.getUser(jwt);
  if(authError||!user)return json({error:"Authentication required"},401);
  const db=createClient(base,service);
  const {data:profile,error:profileError}=await db.from("profiles").select("stripe_customer_id,trial_consumed_at").eq("id",user.id).single();
  if(profileError||!profile)return json({error:"Account not ready"},409);
  const {data:existing,error:subError}=await db.from("subscriptions").select("status").eq("user_id",user.id).in("status",["active","trialing","past_due","incomplete"]);
  if(subError)return json({error:"Unable to check subscription"},503);
  if(existing?.length)return json({error:"Existing subscription found. Use Manage billing."},409);
  const stripe=new Stripe(secret);
  try{
    const checkoutBase=base+"/functions/v1/create-checkout";
    const session=await stripe.checkout.sessions.create({
      mode:"subscription",
      line_items:[{price,quantity:1}],
      customer:profile.stripe_customer_id||undefined,
      customer_email:profile.stripe_customer_id?undefined:user.email,
      client_reference_id:user.id,
      metadata:{batchsave_user_id:user.id},
      subscription_data:{
        metadata:{batchsave_user_id:user.id},
        ...(profile.trial_consumed_at?{}:{trial_period_days:3})
      },
      allow_promotion_codes:true,
      success_url:checkoutBase+"?result=success",
      cancel_url:checkoutBase+"?result=cancel",
    });
    return json({url:session.url});
  }catch(e){console.error("Stripe checkout failed",e);return json({error:"Checkout is temporarily unavailable"},502);}
});