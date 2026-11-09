import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "../config.js";

export const PASSWORD_RECOVERY_REDIRECT=
 "https://gcfyaaqqsqrjwujpymjz.supabase.co/functions/v1/account-recovery";

const HEADERS={"apikey":SUPABASE_PUBLISHABLE_KEY,"content-type":"application/json"};
const RECOVERY_COOLDOWN_KEY="batchsaveRecoveryNextAt";
const RECOVERY_COOLDOWN_MS=60_000;

function authError(payload,status){
 const error=new Error(payload.msg||payload.error_description||payload.message||payload.error||"Password reset request failed");
 error.status=status;
 error.code=payload.error_code||payload.code||payload.error||"";
 return error;
}
async function recoveryRequest(path,options={}){
 const res=await fetch(SUPABASE_URL+path,{...options,headers:{...HEADERS,...options.headers}});
 const payload=await res.json().catch(()=>({}));
 if(!res.ok)throw authError(payload,res.status);
 return payload;
}
async function readCooldown(){
 const stored=await chrome.storage.local.get(RECOVERY_COOLDOWN_KEY);
 const nextAt=Number(stored[RECOVERY_COOLDOWN_KEY]||0);
 return Number.isFinite(nextAt)?nextAt:0;
}
async function writeCooldown(ms=RECOVERY_COOLDOWN_MS){
 const nextAt=Date.now()+ms;
 await chrome.storage.local.set({[RECOVERY_COOLDOWN_KEY]:nextAt});
 return nextAt;
}
export async function passwordResetCooldownSeconds(){
 const nextAt=await readCooldown();
 return Math.max(0,Math.ceil((nextAt-Date.now())/1000));
}

// Recovery never reads, writes, refreshes or clears the extension login session.
export async function requestPasswordReset(email){
 const address=String(email||"").trim().toLowerCase();
 if(!address)throw Error("Email is required.");

 const remaining=await passwordResetCooldownSeconds();
 if(remaining>0){
  const error=new Error("Please wait "+remaining+" seconds before requesting another reset email.");
  error.code="local_recovery_cooldown";
  error.retryAfterSeconds=remaining;
  throw error;
 }

 try{
  const result=await recoveryRequest("/auth/v1/recover?redirect_to="+encodeURIComponent(PASSWORD_RECOVERY_REDIRECT),{
   method:"POST",
   body:JSON.stringify({email:address})
  });
  await writeCooldown();
  return result;
 }catch(error){
  if(error?.status===429||error?.code==="over_email_send_rate_limit"||error?.code==="over_request_rate_limit"){
   await writeCooldown();
  }
  throw error;
 }
}
