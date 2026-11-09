import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "../config.js";

export const PASSWORD_RECOVERY_REDIRECT=
 "https://gcfyaaqqsqrjwujpymjz.supabase.co/functions/v1/account-recovery";

const HEADERS={"apikey":SUPABASE_PUBLISHABLE_KEY,"content-type":"application/json"};

async function recoveryRequest(path,options={}){
 const res=await fetch(SUPABASE_URL+path,{...options,headers:{...HEADERS,...options.headers}});
 const payload=await res.json().catch(()=>({}));
 if(!res.ok){
  const error=new Error(payload.msg||payload.error_description||payload.message||payload.error||"Password reset request failed");
  error.status=res.status;
  error.code=payload.error_code||payload.code||payload.error||"";
  throw error;
 }
 return payload;
}

// Recovery never reads, writes, refreshes or clears the extension login session.
export async function requestPasswordReset(email){
 const address=String(email||"").trim();
 if(!address)throw Error("Email is required.");
 return recoveryRequest("/auth/v1/recover?redirect_to="+encodeURIComponent(PASSWORD_RECOVERY_REDIRECT),{
  method:"POST",
  body:JSON.stringify({email:address})
 });
}
