import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "../config.js";

const HEADERS={"apikey":SUPABASE_PUBLISHABLE_KEY,"content-type":"application/json"};
export const MAGIC_LOGIN_CALLBACK=SUPABASE_URL+"/functions/v1/checkout-return";

function callbackUrl(){
 const url=new URL(MAGIC_LOGIN_CALLBACK);
 url.searchParams.set("result","magic-login");
 url.searchParams.set("extension_id",chrome.runtime.id);
 return url.href;
}
export async function requestMagicLogin(email){
 const address=String(email||"").trim().toLowerCase();
 if(!address)throw Error("Email is required.");
 const redirect=callbackUrl();
 const response=await fetch(SUPABASE_URL+"/auth/v1/otp?redirect_to="+encodeURIComponent(redirect),{
  method:"POST",headers:HEADERS,
  body:JSON.stringify({email:address,create_user:false})
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){
  throw Error(payload.msg||payload.error_description||payload.message||payload.error||"Could not send sign-in link");
 }
 return {ok:true,email:address,redirect};
}
