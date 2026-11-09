import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "../config.js";
const SESSION_KEY="batchsaveSession";
const headers={"apikey":SUPABASE_PUBLISHABLE_KEY,"content-type":"application/json"};
const authLockName="batchsave-auth-session";
let refreshInThisContext=null;

async function request(path,options={}){
 const res=await fetch(SUPABASE_URL+path,{...options,headers:{...headers,...options.headers}});
 const payload=await res.json().catch(()=>({}));
 if(!res.ok){
   const baseMessage=payload.msg||payload.error_description||payload.message||payload.error||"Request failed";
   const missing=Array.isArray(payload.missing)&&payload.missing.length?" · Missing: "+payload.missing.join(", "):"";
   const error=new Error(baseMessage+missing);
   error.status=res.status;error.code=payload.error_code||payload.code||payload.error||"";
   throw error;
 }
 return payload;
}
function stamped(auth){
 return {...auth,expires_at:Math.floor(Date.now()/1000)+(auth.expires_in||3600)};
}
function valid(auth){return Boolean(auth?.access_token&&auth?.expires_at&&Date.now()<auth.expires_at*1000-60000);}
async function stored(){const s=await chrome.storage.local.get(SESSION_KEY);return s[SESSION_KEY]||null;}
async function locked(work){
 if(globalThis.navigator?.locks?.request)return globalThis.navigator.locks.request(authLockName,{mode:"exclusive"},work);
 return work();
}
export async function signUp(email,password){
 const redirect="https://gcfyaaqqsqrjwujpymjz.supabase.co/functions/v1/checkout-return?result=email-confirmed";
 return request("/auth/v1/signup?redirect_to="+encodeURIComponent(redirect),{method:"POST",body:JSON.stringify({email,password})});
}
export async function signOut(){await locked(()=>chrome.storage.local.remove(SESSION_KEY));}
async function refreshStored(){
 const current=await stored();
 if(!current?.access_token)return null;
 if(valid(current))return current;
 if(!current.refresh_token)return null;
 try{
   const updated=stamped(await request("/auth/v1/token?grant_type=refresh_token",{
     method:"POST",body:JSON.stringify({refresh_token:current.refresh_token})
   }));
   // Supabase may omit user from a refresh response: retain the prior user profile for display.
   if(!updated.user&&current.user)updated.user=current.user;
   await chrome.storage.local.set({[SESSION_KEY]:updated});
   return updated;
 }catch(error){
   const latest=await stored();
   if(latest?.refresh_token&&latest.refresh_token!==current.refresh_token)return latest;
   if(error.status===400||error.status===401){
     await chrome.storage.local.remove(SESSION_KEY);
     return null;
   }
   throw error;
 }
}
export async function session(){
 const current=await stored();
 if(!current?.access_token)return null;
 if(valid(current))return current;
 if(globalThis.navigator?.locks?.request)return locked(refreshStored);
 if(!refreshInThisContext)refreshInThisContext=refreshStored().finally(()=>{refreshInThisContext=null;});
 return refreshInThisContext;
}
// Profile display is based on Supabase Auth, never on mailbox Gmail identity.
export async function accountUser(){
 const current=await session();
 if(!current)return null;
 if(current.user?.email)return current.user;
 const user=await request("/auth/v1/user",{headers:{Authorization:"Bearer "+current.access_token}});
 if(user?.id){
   await chrome.storage.local.set({[SESSION_KEY]:{...current,user}});
 }
 return user;
}
export async function entitlement(){
 const s=await session();if(!s)return null;
 const result=await request("/rest/v1/rpc/batchsave_entitlement",{
   method:"POST",headers:{Authorization:"Bearer "+s.access_token},body:"{}"
 });
 return Array.isArray(result)?result[0]||null:result;
}
export async function billingFunction(name){
 const s=await session();if(!s)throw Error("Sign in first.");
 const result=await request("/functions/v1/"+name,{
   method:"POST",headers:{Authorization:"Bearer "+s.access_token},body:"{}"
 });
 if(!result.url||!result.url.startsWith("https://"))throw Error("Invalid payment URL");
 return result.url;
}
