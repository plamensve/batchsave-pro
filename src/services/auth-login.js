import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "../config.js";

const SESSION_KEY="batchsaveSession";
const AUTH_LOCK="batchsave-auth-session";
const HEADERS={"apikey":SUPABASE_PUBLISHABLE_KEY,"content-type":"application/json"};

async function loginRequest(path,options={}){
 const res=await fetch(SUPABASE_URL+path,{...options,headers:{...HEADERS,...options.headers}});
 const payload=await res.json().catch(()=>({}));
 if(!res.ok){
  const error=new Error(payload.msg||payload.error_description||payload.message||payload.error||"Sign in failed");
  error.status=res.status;
  error.code=payload.error_code||payload.code||payload.error||"";
  throw error;
 }
 return payload;
}
function stampSession(auth){
 return {...auth,expires_at:Math.floor(Date.now()/1000)+(auth.expires_in||3600)};
}
async function storeSession(auth){
 const work=()=>chrome.storage.local.set({[SESSION_KEY]:auth});
 if(globalThis.navigator?.locks?.request){
  return globalThis.navigator.locks.request(AUTH_LOCK,{mode:"exclusive"},work);
 }
 return work();
}

// Password login is deliberately isolated from registration and password recovery.
export async function signIn(email,password){
 const address=String(email||"").trim().toLowerCase();
 const secret=String(password??"");
 if(!address||!secret)throw Error("Email and password are required.");
 const response=await loginRequest("/auth/v1/token?grant_type=password",{
  method:"POST",
  body:JSON.stringify({email:address,password:secret})
 });
 const auth=stampSession(response);
 await storeSession(auth);
 return auth;
}
