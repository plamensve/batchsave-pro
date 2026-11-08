import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "../config.js";
const headers={"apikey":SUPABASE_PUBLISHABLE_KEY,"content-type":"application/json"};
async function request(path,options={}){
 const res=await fetch(SUPABASE_URL+path,{...options,headers:{...headers,...options.headers}});
 const payload=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(payload.msg||payload.error_description||payload.message||payload.error||"Request failed");
 return payload;
}
export async function signUp(email,password){return request("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password})});}
export async function signIn(email,password){
 const auth=await request("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
 await chrome.storage.local.set({batchsaveSession:auth});return auth;
}
export async function signOut(){await chrome.storage.local.remove("batchsaveSession");}
export async function session(){
 const {batchsaveSession:s}=await chrome.storage.local.get("batchsaveSession");
 if(!s?.access_token)return null;
 if(Date.now()<((s.expires_at||0)*1000-60000))return s;
 if(!s.refresh_token)return null;
 try{
 const next=await request("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:s.refresh_token})});
 await chrome.storage.local.set({batchsaveSession:next});return next;
 }catch{await signOut();return null;}
}
export async function entitlement(){
 const s=await session();if(!s)return null;
 return request("/rest/v1/rpc/batchsave_entitlement",{method:"POST",headers:{Authorization:"Bearer "+s.access_token},body:"{}"}).then(x=>Array.isArray(x)?x[0]||null:x);
}
export async function billingFunction(name){
 const s=await session();if(!s)throw Error("Sign in first");
 const result=await request("/functions/v1/"+name,{method:"POST",headers:{Authorization:"Bearer "+s.access_token},body:"{}"});
 if(!result.url||!result.url.startsWith("https://"))throw Error("Invalid payment URL");
 return result.url;
}
