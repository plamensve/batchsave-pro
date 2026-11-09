import {session,accountUser,entitlement,billingFunction,updatePassword} from "../services/auth.js";

const $=id=>document.getElementById(id);
$("version").textContent="v"+chrome.runtime.getManifest().version;

function planLabel(status){
 if(status==="tester")return "Internal tester license";
 if(status==="active")return "BatchSave Pro · Active";
 if(status==="trialing")return "BatchSave Pro · Trial";
 return status||"No active subscription";
}
function showSection(id){
 for(const section of document.querySelectorAll(".settings-section"))section.hidden=section.id!==id;
 for(const item of document.querySelectorAll(".nav-item"))item.classList.toggle("active",item.dataset.target===id);
}
for(const item of document.querySelectorAll(".nav-item"))item.addEventListener("click",()=>showSection(item.dataset.target));

async function loadAccount(){
 const currentSession=await session();
 if(!currentSession){
  $("signed-out").hidden=false;
  $("password-form").querySelectorAll("input,button").forEach(el=>el.disabled=true);
  return;
 }
 const user=await accountUser().catch(()=>currentSession.user||null);
 const info=await entitlement().catch(()=>null);
 const identity=user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split("@")[0]||"BatchSave account";
 $("avatar").textContent=identity.trim().charAt(0).toUpperCase()||"B";
 $("name").textContent=identity;
 $("email").textContent=user?.email||"Email unavailable";
 $("plan").textContent=planLabel(info?.subscription_status);
 const managed=["active","trialing"].includes(info?.subscription_status);
 $("manage-subscription").hidden=!managed;
 $("subscription-copy").textContent=managed
  ?"Your Stripe subscription is active. Open the billing portal to manage payment details or cancellation."
  :info?.subscription_status==="tester"
   ?"This account has an internal tester license."
   :"No active paid subscription is attached to this account.";
}

$("manage-subscription").addEventListener("click",async()=>{
 const button=$("manage-subscription");button.disabled=true;
 try{
  const url=await billingFunction("billing-portal");
  await chrome.tabs.create({url});
 }catch(error){
  const status=$("password-status");status.hidden=false;status.className="status error";status.textContent="Billing: "+error.message;
 }finally{button.disabled=false;}
});

$("password-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const password=$("new-password").value;
 const confirm=$("confirm-password").value;
 const status=$("password-status");
 if(password.length<8){status.hidden=false;status.className="status error";status.textContent="Use a password of at least 8 characters.";return;}
 if(password!==confirm){status.hidden=false;status.className="status error";status.textContent="The two passwords do not match.";return;}
 const button=$("save-password");button.disabled=true;
 try{
  await updatePassword(password);
  $("new-password").value="";$("confirm-password").value="";
  status.hidden=false;status.className="status success";status.textContent="Password updated successfully.";
 }catch(error){
  status.hidden=false;status.className="status error";status.textContent="Password update failed: "+error.message;
 }finally{button.disabled=false;}
});

loadAccount().catch(error=>{
 $("signed-out").hidden=false;
 $("signed-out").querySelector("p").textContent="Settings could not load: "+error.message;
});
