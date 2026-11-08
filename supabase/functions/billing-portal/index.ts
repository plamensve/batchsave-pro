import Stripe from "npm:stripe@20.0.0";
import {createClient} from "npm:@supabase/supabase-js@2.76.1";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"OPTIONS,POST"};
const json=(data,status=200)=>Response.json(data,{status,headers:cors});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),key=Deno.env.get("STRIPE_SECRET_KEY");
 if(!url||!anon||!service||!key)return json({error:"Stripe not configured"},503);
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const client=createClient(url,anon),db=createClient(url,service);
 const {data:{user},error}=await client.auth.getUser(token);if(error||!user)return json({error:"Authentication required"},401);
 const {data:p}=await db.from("profiles").select("stripe_customer_id").eq("id",user.id).single();
 if(!p?.stripe_customer_id)return json({error:"No subscription customer found"},404);
 try{
  const stripe=new Stripe(key);
  const session=await stripe.billingPortal.sessions.create({customer:p.stripe_customer_id,return_url:url+"/functions/v1/checkout-return?result=return"});
  return json({url:session.url});
 }catch(e){console.error("Stripe portal failed",e);return json({error:"Billing portal unavailable"},502);}
});