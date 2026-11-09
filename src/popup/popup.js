import {scanVisibleGmailAttachments,downloadVisibleGmailAttachment,downloadAllVisibleGmailAttachments,diagnoseVisibleGmailAttachments} from "../services/gmail-visible.js";
import {makeZip} from "../lib/zip.js";
import {batchFolder,batchArchiveName} from "../lib/download-batch.js";
import {downloadPlan} from "../lib/download-plan.js";
import {SCAN_STATE_KEY,makeScanSnapshot,canRestoreScanSnapshot} from "../lib/scan-state.js";
import {classifyFile,filenameFromUrl,uniqueFiles,collectFromPage,isUsefulFile,isMeaningfulImage} from "../lib/files.js";
import {signUp,signOut,session,accountUser,entitlement,billingFunction} from "../services/auth.js";
import {signIn} from "../services/auth-login.js";
import {requestPasswordReset} from "../services/auth-recovery.js";
import {initPopupPdfTools} from "./pdf-tools-panel.js";
const $=id=>document.getElementById(id);
$("version").textContent="v"+chrome.runtime.getManifest().version;
$("settings").addEventListener("click",()=>chrome.runtime.openOptionsPage());

function setWorkspaceTab(panelId){
 const selected=panelId==="pdf-tools-panel"?"pdf-tools-panel":"downloads-panel";
 for(const tab of document.querySelectorAll(".workspace-tab")){
  const active=tab.dataset.panel===selected;
  tab.classList.toggle("active",active);
  tab.setAttribute("aria-selected",String(active));
 }
 $("downloads-panel").hidden=selected!=="downloads-panel";
 $("pdf-tools-panel").hidden=selected!=="pdf-tools-panel";
 chrome.storage.session.set({batchsaveWorkspaceTab:selected}).catch(()=>{});
}
for(const tab of document.querySelectorAll(".workspace-tab")){
 tab.addEventListener("click",()=>setWorkspaceTab(tab.dataset.panel));
}
const state={files:[],selected:new Set(),source:"page",access:false,busy:false,googleReady:false,scanTabId:null,scanTabUrl:""};
const SIZE_LIMIT=100*1024*1024;
const fileKey=f=>f.id||f.url;
const isEmail=f=>f.source==="gmail-visible";
const IMAGE_NAME_RE=/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|[?#])/i;
const PDF_NAME_RE=/\.pdf(?:$|[?#])/i;
const SVG_NS="http://www.w3.org/2000/svg";
const VECTOR_ICONS={
 image:[["rect",{x:"3",y:"4",width:"18",height:"16",rx:"3"}],["circle",{cx:"9",cy:"9",r:"1.5"}],["path",{d:"m5.5 17 4.5-4 3 2.5 2.5-2 3 3"}]],
 pdf:[["path",{d:"M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"}],["path",{d:"M14 3v5h5M8 13h8M8 17h6"}]],
 attachment:[["path",{d:"m9.5 12.5 5.2-5.2a3 3 0 1 1 4.2 4.2l-7.4 7.4a5 5 0 0 1-7.1-7.1l7.8-7.8"}],["path",{d:"m7.2 14.8 7-7"}]],
 file:[["path",{d:"M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"}],["path",{d:"M14 3v5h5"}]]
};
function vectorIcon(name,className="ui-icon"){
 const svg=document.createElementNS(SVG_NS,"svg");
 svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");svg.classList.add(className);
 for(const [tag,attrs] of (VECTOR_ICONS[name]||VECTOR_ICONS.file)){
  const node=document.createElementNS(SVG_NS,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
  svg.append(node);
 }
 return svg;
}
const isPreviewableImage=f=>typeOf(f)==="image"||f.mimeType?.startsWith("image/")||IMAGE_NAME_RE.test(f.name||"")||IMAGE_NAME_RE.test(f.url||"");
const isPreviewablePdf=f=>typeOf(f)==="pdf"||f.mimeType==="application/pdf"||PDF_NAME_RE.test(f.name||"")||PDF_NAME_RE.test(f.url||"");
let previewBlobUrl=null,previewFocus=null;
function clearPreviewSource(){
 const image=$("preview-image"),frame=$("preview-frame");
 image.removeAttribute("src");frame.removeAttribute("src");
 image.hidden=true;frame.hidden=true;$("preview-details").hidden=true;$("preview-error").hidden=true;
 if(previewBlobUrl){URL.revokeObjectURL(previewBlobUrl);previewBlobUrl=null;}
}
function closePreview(){
 $("preview-dialog").hidden=true;
 clearPreviewSource();
 previewFocus?.focus();previewFocus=null;
}
function previewDetails(file){
 const parts=[file.name||"Unnamed file","Type: "+typeOf(file).toUpperCase()];
 if(file.mimeType)parts.push("MIME: "+file.mimeType);
 if(file.size)parts.push("Size: "+Math.ceil(file.size/1024)+" KB");
 if(file.subject)parts.push("Email: "+file.subject);
 if(file.url){
  try{parts.push("Host: "+new URL(file.url).hostname);}catch{}
 }
 return parts.join("\n");
}
async function previewSource(file){
 return file.url||"";
}
async function openPreview(file,button){
 closePreview();
 previewFocus=button;
 const dialog=$("preview-dialog"),image=$("preview-image"),frame=$("preview-frame"),details=$("preview-details"),error=$("preview-error");
 $("preview-title").textContent=file.name||"File preview";
 dialog.hidden=false;$("preview-close").focus();
 details.textContent=previewDetails(file);
 if(file.source==="gmail-visible"&&!file.url){
  details.hidden=false;return;
 }
 try{
  if(isPreviewableImage(file)){
   const src=await previewSource(file);
   if(!src)throw Error("No preview source");
   image.hidden=false;
   image.onerror=()=>{image.hidden=true;details.hidden=false;error.hidden=false;};
   image.src=src;return;
  }
  if(isPreviewablePdf(file)){
   const src=await previewSource(file);
   if(!src)throw Error("No preview source");
   frame.hidden=false;frame.src=src;return;
  }
  details.hidden=false;
 }catch{
  details.hidden=false;error.hidden=false;
 }
}
$("preview-close").addEventListener("click",closePreview);
$("preview-dialog").addEventListener("click",event=>{if(event.target===$("preview-dialog"))closePreview();});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("preview-dialog").hidden)closePreview();});
function notice(msg){
 const status=$("status"),text=status.querySelector(".notice-text");
 if(text)text.textContent=msg;else status.textContent=msg;
}
function authFeedback(msg,kind="info"){
 const box=$("auth-feedback");box.hidden=!msg;box.textContent=msg||"";box.dataset.kind=kind;
 if(msg)box.scrollIntoView({block:"nearest",behavior:"instant"});
}

const passwordInput=$("password");
let capsLockOn=false;
for(const eventName of ["keydown","keyup"]){
 passwordInput.addEventListener(eventName,event=>{
  if(typeof event.getModifierState==="function")capsLockOn=event.getModifierState("CapsLock");
 });
}
function passwordDiagnostics(secret){
 const text=String(secret??"");
 const count=[...text].length;
 const issues=[];
 if(/^\s|\s$/u.test(text))issues.push("leading or trailing whitespace");
 if(/[\u200B-\u200D\u2060\uFEFF]/u.test(text))issues.push("an invisible Unicode character");
 if(/[\u0000-\u001F\u007F-\u009F]/u.test(text))issues.push("a control character");
 if(capsLockOn)issues.push("Caps Lock is on");
 return {count,issues};
}
function clearPasswordInput(){
 passwordInput.value="";
 passwordInput.type="password";
 const toggle=$("toggle-password");
 toggle.setAttribute("aria-label","Show password");
 toggle.title="Show password";
}
$("toggle-password").addEventListener("click",()=>{
 const showing=passwordInput.type==="text";
 passwordInput.type=showing?"password":"text";
 const label=showing?"Show password":"Hide password";
 $("toggle-password").setAttribute("aria-label",label);
 $("toggle-password").title=label;
 passwordInput.focus();
});

function message(msg){
 const box=$("account-status"),text=box.querySelector(".account-status-text");
 if(text)text.textContent=msg;else box.textContent=msg;
 box.dataset.tone=/Tester access active|Trial|Pro active|Signed in/i.test(msg)?"success":
   /required|failed|unavailable/i.test(msg)?"warning":"info";
}
function typeOf(f){
 if(isEmail(f)){
  if(f.mimeType?.startsWith("image/"))return "image";
  if(f.mimeType==="application/pdf"||/\.pdf$/i.test(f.name))return "pdf";
  return "attachment";
 }
 return f.kind;
}
function filtered(){
 const type=$("type").value,search=$("search").value.toLowerCase().trim();
 return state.files.filter(f=>{
  let show=type==="all"||(type==="relevant"&&(isEmail(f)||isUsefulFile(f)))||
    (type==="attachment"&&(isEmail(f)||f.kind==="attachment"))||
    (type==="image"&&(isEmail(f)?typeOf(f)==="image":isMeaningfulImage(f)))||
    (type==="pdf"&&typeOf(f)==="pdf")||
    (type==="other"&&(typeOf(f)==="other"||(isEmail(f)&&typeOf(f)==="attachment")));
  return show&&(!search||[f.name,f.subject||"",f.from||"",f.url||""].some(s=>s.toLowerCase().includes(search)));
 });
}
async function persistScanState(){
 if(!state.files.length)return;
 const snapshot=makeScanSnapshot({
  files:state.files,
  selected:[...state.selected],
  source:state.source,
  search:$("search").value,
  type:$("type").value,
  tabId:state.scanTabId,
  tabUrl:state.scanTabUrl
 });
 await chrome.storage.session.set({[SCAN_STATE_KEY]:snapshot});
}
let persistTimer=null;
function queuePersistScanState(){
 clearTimeout(persistTimer);
 persistTimer=setTimeout(()=>persistScanState().catch(()=>{}),60);
}
async function restoreScanState(){
 const stored=await chrome.storage.session.get(SCAN_STATE_KEY);
 const snapshot=stored[SCAN_STATE_KEY];
 if(!snapshot)return false;
 let tab=null;
 try{[tab]=await chrome.tabs.query({active:true,currentWindow:true});}catch{}
 if(!canRestoreScanSnapshot(snapshot,{tabId:tab?.id??null,tabUrl:tab?.url||""}))return false;
 state.files=snapshot.files;
 state.source=snapshot.source;
 state.selected=new Set(snapshot.selected||[]);
 state.scanTabId=snapshot.tabId;
 state.scanTabUrl=snapshot.tabUrl||"";
 $("search").disabled=false;$("search").value=snapshot.search||"";
 $("type").disabled=false;$("type").value=[...$("type").options].some(o=>o.value===snapshot.type)?snapshot.type:"relevant";
 $("gmail-controls").hidden=!isEmail({source:state.source});
 render();
 notice("Restored the last scan · "+state.files.length+" file(s).");
 return true;
}
function updateCount(){
 const count=state.selected.size,visible=filtered().length,available=!state.busy;
 $("selected").textContent=count+" selected";
 $("download").disabled=!count||!available;
 const label=$("download").querySelector(".button-label");
 if(label)label.textContent=count>1?"Download ZIP ("+count+")":"Download file";
 const zipCount=count||visible,zipLabel=$("download-zip").querySelector(".zip-label");
 $("download-zip").hidden=false;
 $("download-zip").disabled=!available||zipCount<2;
 if(zipLabel)zipLabel.textContent=count?"Download ZIP ("+count+")":visible>=2?"ZIP all visible ("+visible+")":"Download ZIP";
 $("clear-selection").disabled=!count||state.busy;
 $("clear-results").disabled=!state.files.length||state.busy;
 $("select-all").disabled=!visible||state.busy;
}
function render(){
 const shown=filtered(),target=$("results");target.replaceChildren();
 if(!shown.length){
  const empty=document.createElement("div");empty.className="empty";
  const title=document.createElement("strong");
  const detail=document.createElement("span");
  if(!state.files.length){
   title.textContent="Ready to scan";
   detail.textContent="Open a page or Gmail and click Scan this page.";
  }else if(isEmail({source:state.source})){
   title.textContent="No matching attachments";
   detail.textContent="Try another filter or scan the Gmail message again.";
  }else{
   title.textContent="No matching files";
   detail.textContent="Try another filter or scan the page again.";
  }
  empty.append(title,detail);
  target.append(empty);
 }
 for(const [index,f] of shown.entries()){
  const row=document.createElement("div");row.className="file";
  row.title=isEmail(f)?(f.subject||f.name):f.url;
  const checkbox=document.createElement("input");
  checkbox.type="checkbox";checkbox.id="file-check-"+index;
  checkbox.setAttribute("aria-label","Select "+f.name);
  checkbox.checked=state.selected.has(fileKey(f));
  checkbox.addEventListener("change",()=>{
   checkbox.checked?state.selected.add(fileKey(f)):state.selected.delete(fileKey(f));updateCount();queuePersistScanState();
  });
  const meta=document.createElement("label");meta.className="file-meta";meta.htmlFor=checkbox.id;
  const title=document.createElement("span");title.className="file-name";title.textContent=f.name;
  const desc=document.createElement("span");desc.className="file-sub";
  desc.textContent=isEmail(f)?(f.subject||"(No subject)")+" · "+(f.source==="gmail-visible"?"Native Gmail download":f.size?Math.ceil(f.size/1024)+" KB":"Gmail"):(new URL(f.url).hostname+" · "+typeOf(f).toUpperCase());
  meta.append(title,desc);

  const trigger=document.createElement("button");
  trigger.type="button";trigger.className="preview-trigger";
  trigger.title="Preview "+f.name;trigger.setAttribute("aria-label","Preview "+f.name);
  if(isPreviewableImage(f)&&f.source!=="gmail-visible"){
   const image=document.createElement("img");image.className="file-thumb";
   image.alt="";image.loading="lazy";image.decoding="async";image.referrerPolicy="no-referrer";
   const fallback=document.createElement("span");fallback.className="preview-fallback";fallback.append(vectorIcon("image","preview-vector"));
   fallback.hidden=!!f.url;image.hidden=!f.url;
   image.addEventListener("error",()=>{image.hidden=true;fallback.hidden=false;});
   if(f.url)image.src=f.url;
   trigger.append(image,fallback);
  }else{
   const symbol=document.createElement("span");symbol.className="preview-fallback";
   symbol.append(vectorIcon(isPreviewablePdf(f)?"pdf":isEmail(f)?"attachment":"file","preview-vector"));
   trigger.append(symbol);
  }
  trigger.addEventListener("click",()=>openPreview(f,trigger));
  const badge=document.createElement("span");
  badge.className="file-type-badge";
  const ext=(f.name?.match(/\.([a-z0-9]{1,6})$/i)?.[1]||typeOf(f)||"FILE").toUpperCase();
  badge.textContent=ext==="ATTACHMENT"?"FILE":ext;
  row.append(checkbox,trigger,meta,badge);
  target.append(row);
 }
 $("count").textContent=state.files.length
  ?shown.length+" shown · "+state.files.length+(isEmail({source:state.source})?" Gmail attachments":" page files")
  :"No files scanned";
 updateCount();
}
function showFiles(files,source,context={}){
 state.files=source==="page"?uniqueFiles(files):files;
 state.source=source;state.selected.clear();
 state.scanTabId=Number.isInteger(context.tabId)?context.tabId:null;
 state.scanTabUrl=context.tabUrl||"";
 if(source==="gmail-visible"&&state.files.length===1)state.selected.add(fileKey(state.files[0]));
 $("search").disabled=false;$("search").value="";
 $("type").disabled=false;$("type").value="relevant";render();
 if(state.files.length)persistScanState().catch(()=>{});
 else chrome.storage.session.remove(SCAN_STATE_KEY).catch(()=>{});
}
function displayProfile(user,plan){
 const identity=user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split("@")[0]||"BatchSave account";
 $("account-name").textContent=identity;
 $("account-email").textContent=user?.email||"Email unavailable";
 $("account-license").textContent="Current plan: "+(plan||"Unavailable");
 $("header-account").hidden=false;
 $("account-details").hidden=false;
}
async function refreshAccount(){
 const root=document.documentElement;
 root.classList.remove("signed-out","signup-open");
 $("auth-panel").classList.remove("session-active");
 $("auth-form").hidden=true;$("signup-form").hidden=true;$("billing-actions").hidden=true;
 $("account-details").hidden=true;$("header-account").hidden=true;
 $("logout").hidden=true;$("settings").hidden=true;$("main-workspace").hidden=true;
 let s;
 try{
  s=await session();
 }catch(e){
  state.access=false;
  root.classList.add("signed-out");
  $("auth-form").hidden=false;
  authFeedback("Connection issue. Your saved login could not be verified. Try again when online.","error");
  updateCount();return;
 }
 if(!s){
  state.access=false;
  root.classList.add("signed-out");
  $("auth-form").hidden=false;
  updateCount();return;
 }
 $("auth-panel").classList.add("session-active");
 $("logout").hidden=false;$("settings").hidden=false;$("main-workspace").hidden=false;
 const current=await accountUser().catch(()=>s.user||null);
 try{
  const info=await entitlement();
  state.access=!!info?.access_granted;
  const expires=info?.trial_ends_at?new Date(info.trial_ends_at).getTime():0;
  const remaining=expires-Date.now();
  const subscriptionStatus=info?.subscription_status||null;
  const license=subscriptionStatus==="tester"?"Internal tester license":
    subscriptionStatus==="active"?"BatchSave Pro · Active":
    subscriptionStatus==="trialing"?"BatchSave Pro · Trial":
    subscriptionStatus||"No active subscription";
  displayProfile(current,license);
  const signedInStatus=subscriptionStatus==="tester"
    ?"Signed in · Tester access active"
    :subscriptionStatus==="trialing"
      ?(remaining>0?"Signed in · Trial · "+Math.ceil(remaining/3600000)+"h left":"Signed in · Trial active")
      :subscriptionStatus==="active"
        ?"Signed in · BatchSave Pro active"
        :state.access
          ?"Signed in · Access active"
          :"Signed in · Trial or subscription required";
  message(signedInStatus);
  $("billing-actions").hidden=false;
  const tester=subscriptionStatus==="tester";
  const managedSubscription=["active","trialing"].includes(subscriptionStatus);
  $("upgrade").hidden=!tester&&managedSubscription;
  const upgradeLabel=$("upgrade").querySelector(".upgrade-label");
  if(upgradeLabel)upgradeLabel.textContent=tester?"Test Stripe checkout · €9.90/month":"Start 3-day free trial · €9.90/month";
  $("manage").hidden=!managedSubscription;
 }catch(e){
  state.access=false;displayProfile(current,"License check unavailable");
  message("Signed in · license check failed: "+e.message);
  $("billing-actions").hidden=false;$("upgrade").hidden=true;$("manage").hidden=true;
 }
 updateCount();
}
$("auth-form").addEventListener("submit",async ev=>{
 ev.preventDefault();
 const button=$("login");button.disabled=true;
 try{
  authFeedback("Checking your account…");
  const email=$("email").value.trim();
  await chrome.storage.local.set({batchsaveLastEmail:email});
  await signIn(email,$("password").value);
  notice("Signed in successfully.");await refreshAccount();authFeedback("");
 }catch(e){
  const bad=e?.code==="invalid_credentials"||/invalid login credentials/i.test(e.message);
  if(bad){
   const diagnosis=passwordDiagnostics(passwordInput.value);
   const issueText=diagnosis.issues.length?" Detected: "+diagnosis.issues.join(", ")+".":"";
   passwordInput.focus();
   authFeedback(
    "Supabase rejected the exact "+diagnosis.count+"-character password sent. BatchSave does not trim or alter password characters."+issueText+
    " If Chrome autofilled this field, clear it completely and type the current password again. You can use the eye icon to verify every character.",
    "error"
   );
  }else{
   authFeedback(`Sign in failed: ${e.message}`,"error");
  }
 }finally{button.disabled=false;}
});
function openSignupForm(){
 const email=$("email").value.trim();
 document.documentElement.classList.add("signup-open");
 $("auth-form").hidden=true;
 $("signup-form").hidden=false;
 $("signup-email").value=email;
 $("signup-password").value="";
 $("signup-confirm").value="";
 authFeedback("");
 $("signup-name").focus();
}
function closeSignupForm(){
 document.documentElement.classList.remove("signup-open");
 $("signup-form").hidden=true;
 $("auth-form").hidden=false;
 if($("signup-email").value.trim())$("email").value=$("signup-email").value.trim();
 $("signup-password").value="";
 $("signup-confirm").value="";
 authFeedback("");
 $("email").focus();
}
$("register").addEventListener("click",openSignupForm);
$("signup-cancel").addEventListener("click",closeSignupForm);
$("signup-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const name=$("signup-name").value.trim();
 const email=$("signup-email").value.trim();
 const password=$("signup-password").value;
 const confirm=$("signup-confirm").value;
 if(!name){authFeedback("Enter your full name.","error");$("signup-name").focus();return;}
 if(!email){authFeedback("Enter your email address.","error");$("signup-email").focus();return;}
 if(password.length<8){authFeedback("Use a password of at least 8 characters.","error");$("signup-password").focus();return;}
 if(password!==confirm){authFeedback("The two passwords do not match.","error");$("signup-confirm").focus();return;}
 const button=$("signup-submit");button.disabled=true;
 try{
  authFeedback("Creating your BatchSave account…");
  await signUp(email,password,{fullName:name});
  await chrome.storage.local.set({batchsaveLastEmail:email.trim().toLowerCase()});
  $("email").value=email.trim().toLowerCase();
  $("signup-password").value="";$("signup-confirm").value="";
  document.documentElement.classList.remove("signup-open");
  $("signup-form").hidden=true;$("auth-form").hidden=false;
  clearPasswordInput();
  authFeedback("Registration request processed. If this email is new, check your inbox and spam folder for the confirmation message. If no confirmation email arrives, the address may already be registered — use Sign in or Send reset email instead.","success");
  notice("Registration request processed.");
 }catch(e){
  authFeedback("Account creation failed: "+e.message,"error");
 }finally{button.disabled=false;}
});
$("reset-password").addEventListener("click",async()=>{
 const email=$("email").value.trim();
 if(!email){authFeedback("Enter the email address used to create your BatchSave account, then choose Send reset email.","error");$("email").focus();return;}
 $("reset-password").disabled=true;
 try{
  authFeedback("Requesting password reset email…");
  await chrome.storage.local.set({batchsaveLastEmail:email});
  await requestPasswordReset(email);
  clearPasswordInput();
  authFeedback("Reset request accepted. Check the inbox and spam folder of "+email+". Open the NEWEST password reset email, set a new password, and wait for “Password updated successfully”. Then reopen BatchSave Pro, click the password field, and type the NEW password.","success");
  notice("Password reset email sent. Use the newest message.");
 }
 catch(e){
  if(e?.code==="over_email_send_rate_limit"){
   authFeedback("No reset email was sent. Supabase's built-in Auth email quota is exhausted (2 Auth emails per hour for the entire project). This limit can only be raised after custom SMTP or a Send Email Hook is configured.","error");
  }else if(e?.code==="over_request_rate_limit"){
   authFeedback("No reset email was sent because Supabase temporarily rate-limited Auth requests from this connection. Repeated clicks will not help; BatchSave will block rapid retries locally.","error");
  }else if(e?.code==="local_recovery_cooldown"){
   authFeedback("Reset request not sent: "+e.message,"error");
  }else{
   authFeedback("Password reset request failed: "+e.message,"error");
  }
 }
 finally{$("reset-password").disabled=false;}
});
$("logout").addEventListener("click",async()=>{
 await signOut();state.selected.clear();authFeedback("");await refreshAccount();render();notice("Signed out.");
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
$("upgrade").addEventListener("click",async()=>{
 const button=$("upgrade"),label=button.querySelector(".upgrade-label");
 const original=label?.textContent||"Start 3-day free trial · €9.90/month";
 button.disabled=true;button.classList.add("billing-launching");
 try{
  for(const n of [3,2,1]){
   if(label)label.textContent="Opening Stripe · "+n;
   await sleep(700);
  }
  if(label)label.textContent="Creating secure checkout…";
  const url=await billingFunction("create-checkout");
  if(label)label.textContent="Opening Stripe…";
  await chrome.tabs.create({url});
  notice("Stripe Checkout opened in a new tab.");
  authFeedback("");
 }catch(e){
  const msg="Stripe checkout failed: "+e.message;
  notice(msg);
  authFeedback(msg,"error");
 }finally{
  button.classList.remove("billing-launching");
  button.disabled=false;
  if(label)label.textContent=original;
 }
});
$("manage").addEventListener("click",async()=>{
 const button=$("manage");button.disabled=true;
 try{const url=await billingFunction("billing-portal");await chrome.tabs.create({url});}
 catch(e){const msg="Billing portal failed: "+e.message;notice(msg);authFeedback(msg,"error");}
 finally{button.disabled=false;}
});
async function scanGmail(tab){
 const tabId=tab.id;
 notice("Checking attachments in the open Gmail conversation…");
 const [{result:visible}]=await chrome.scripting.executeScript({target:{tabId},func:scanVisibleGmailAttachments});
 if(visible?.length){
   showFiles(visible,"gmail-visible",{tabId,tabUrl:tab.url||""});
   notice(visible.length+" attached file(s) found. Select 2+ files to create one ZIP when Gmail exposes direct attachment URLs.");
   return;
 }
 // Do not retain stale files from a previous Gmail conversation.
 showFiles([],"gmail-visible",{tabId,tabUrl:tab.url||""});
 let diagnostic={cards:0,downloadDescriptors:0,namedNodes:0,filenameLabels:0};
 try{
  const [{result}]=await chrome.scripting.executeScript({target:{tabId},func:diagnoseVisibleGmailAttachments});
  if(result)diagnostic=result;
 }catch{}
 const detail=`Gmail markers: ${diagnostic.cards} attachment cards, ${diagnostic.downloadDescriptors} download descriptors, ${diagnostic.filenameLabels} filename labels.`;
 notice("No attachment filenames recognized. "+detail+" Open a Gmail conversation with visible attachment cards, then scan again.");
}
$("scan").addEventListener("click",async()=>{
 const button=$("scan");button.disabled=true;state.busy=true;updateCount();
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)throw Error("No active browser tab.");
  const gmail=tab.url?.startsWith("https://mail.google.com/");
  $("gmail-controls").hidden=!gmail;
  if(gmail){
   await scanGmail(tab);
  }else{
   notice("Scanning the current page…");
   const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:collectFromPage});
   const files=(result||[]).map(f=>({...f,kind:classifyFile(f.url,f.kind),name:f.name||filenameFromUrl(f.url)}));
   showFiles(files,"page",{tabId:tab.id,tabUrl:tab.url||""});
   notice(filtered().length+" relevant files/photos detected.");
  }
 }catch(e){notice("Scan failed: "+e.message);}
 finally{button.disabled=false;state.busy=false;updateCount();}
});
$("search").addEventListener("input",()=>{render();queuePersistScanState();});
$("type").addEventListener("change",()=>{render();queuePersistScanState();});
$("select-all").addEventListener("click",()=>{
 for(const f of filtered())state.selected.add(fileKey(f));
 render();queuePersistScanState();
});
$("clear-selection").addEventListener("click",()=>{state.selected.clear();render();queuePersistScanState();});
$("clear-results").addEventListener("click",async()=>{
 if(state.busy)return;
 state.files=[];
 state.selected.clear();
 state.source="page";
 state.scanTabId=null;
 state.scanTabUrl="";
 $("search").value="";$("search").disabled=true;
 $("type").value="relevant";$("type").disabled=true;
 await chrome.storage.session.remove(SCAN_STATE_KEY);
 render();
 notice("Scanned results cleared.");
});
function selectedFiles(){return state.files.filter(f=>state.selected.has(fileKey(f)));}
function safeName(name){
 return String(name||"file").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/^\.+/,"").slice(0,150)||"file";
}
function saveBlob(blob,name,saveAs=false){
 const url=URL.createObjectURL(blob);
 return chrome.downloads.download({url,filename:name,saveAs,conflictAction:"uniquify"}).finally(()=>{
  setTimeout(()=>URL.revokeObjectURL(url),120000);
 });
}
async function mustHaveLicense(){
 const activeSession=await session();
 if(!activeSession){
  state.access=false;
  $("auth-form").hidden=false;
  throw Error("Sign in is required before downloading.");
 }
 const response=await chrome.runtime.sendMessage({type:"CHECK_LICENSE"});
 if(!response?.ok)throw Error(response?.error||"License check failed.");
 const e=response.entitlement;
 state.access=!!response.access_granted;
 if(!state.access)throw Error("Your trial, tester access or subscription is not active.");
 return e;
}
function reportDownloadError(prefix,error){
 const msg=prefix+": "+(error?.message||String(error));
 notice(msg);
 if(/sign in|required|license|trial|subscription|tester/i.test(msg))authFeedback(msg,"error");
}
$("download").addEventListener("click",async()=>{
 const files=selectedFiles();
 const plan=downloadPlan(files,state.source);
 if(plan.mode==="none")return;
 state.busy=true;updateCount();
 try{
  if(plan.mode==="zip"){
   await requestZipPermissions(files);
   await mustHaveLicense();
   await downloadZipFiles(files);
   return;
  }
  await mustHaveLicense();

  if(plan.mode==="gmail-visible-single"){
   const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
   if(!tab?.url?.startsWith("https://mail.google.com/"))throw Error("Open the Gmail message again.");
   const f=files[0],folder=batchFolder();
   notice("Preparing "+f.name+" in Downloads/"+folder+"…");
   const prior=await chrome.downloads.search({limit:100,orderBy:["-startTime"]});
   const known=new Set(prior.map(item=>item.id));
   const prep=await chrome.runtime.sendMessage({type:"PREPARE_GMAIL_DOWNLOAD",folder,expectedName:f.name});
   if(!prep?.ok)throw Error(prep?.error||"Cannot prepare Gmail destination folder.");
   try{
    const [{result}]=await chrome.scripting.executeScript({
     target:{tabId:tab.id},world:"MAIN",func:downloadVisibleGmailAttachment,args:[f.position,f.name]
    });
    if(!result?.ok)throw Error(result?.error||"Gmail download is unavailable");
    let detected=null,renamed=false;
    for(let attempt=0;attempt<12;attempt++){
     await new Promise(resolve=>setTimeout(resolve,350));
     const current=await chrome.downloads.search({limit:100,orderBy:["-startTime"]});
     detected=current.find(item=>!known.has(item.id))||null;
     const routing=await chrome.runtime.sendMessage({type:"GET_GMAIL_FOLDER_STATE"});
     renamed=!!(routing?.handled&&routing.downloadId===detected?.id);
     if(detected&&renamed)break;
    }
    if(!detected)throw Error("Chrome did not start a download for "+f.name+".");
    notice(renamed?"Downloaded "+f.name+" to Downloads/"+folder+".":"Chrome started "+f.name+". Check Chrome Downloads.");
   }finally{
    await chrome.runtime.sendMessage({type:"CLEAR_GMAIL_FOLDER"}).catch(()=>{});
   }
   return;
  }

  const response=await chrome.runtime.sendMessage({
   type:"BATCH_DOWNLOAD",items:files.map(f=>({url:f.url,filename:f.name}))
  });
  if(!response?.ok)throw Error(response?.error||response?.errors?.[0]||"Download failed");
  notice("Started "+response.started+" download(s) in Downloads/"+response.folder+(response.failed?" · "+response.failed+" failed":"")+".");
 }catch(e){reportDownloadError("Download failed",e);}
 finally{state.busy=false;updateCount();}
});
async function downloadNativeGmailZip(files){
 if(state.source!=="gmail-visible")return false;
 if(files.length!==state.files.length)throw Error("For Gmail native ZIP, include all attachments from the open message.");
 const tabId=state.scanTabId;
 if(!Number.isInteger(tabId))throw Error("The original Gmail tab is unavailable. Open the message and scan again.");
 await mustHaveLicense();
 notice("Starting Gmail's Download all attachments ZIP…");
 const prior=await chrome.downloads.search({limit:100,orderBy:["-startTime"]});
 const known=new Set(prior.map(item=>item.id));
 const [{result}]=await chrome.scripting.executeScript({
  target:{tabId},world:"MAIN",func:downloadAllVisibleGmailAttachments,args:[files.map(f=>f.name)]
 });
 if(!result?.ok)throw Error(result?.error||"Gmail Download all is unavailable.");
 let detected=null;
 for(let attempt=0;attempt<15;attempt++){
  await sleep(300);
  const current=await chrome.downloads.search({limit:100,orderBy:["-startTime"]});
  detected=current.find(item=>!known.has(item.id))||null;
  if(detected)break;
 }
 if(!detected)throw Error("Gmail did not start the ZIP download.");
 notice("Gmail ZIP download started · "+files.length+" attachment(s).");
 return true;
}
async function requestZipPermissions(files){
 const missing=files.filter(f=>!f.url);
 if(missing.length)throw Error("Some selected files do not expose a downloadable URL. Rescan the page or Gmail message.");
 const origins=[...new Set(files.map(f=>new URL(f.url).origin+"/*"))];
 if(origins.length&&!(await chrome.permissions.request({origins})))
  throw Error("Site access denied. Allow access to the file hosts to build a ZIP.");
}
async function downloadZipFiles(files){
 if(!files.length)throw Error("Select at least one file.");
 if(files.length>150)throw Error("ZIP supports up to 150 files.");
 const entries=[];let total=0;
 for(const f of files){
  notice("Adding to ZIP "+(entries.length+1)+"/"+files.length+": "+f.name);
  if(total+(f.size||0)>SIZE_LIMIT)throw Error("ZIP exceeds the 100 MB limit.");
  if(!f.url)throw Error("No downloadable URL for "+f.name);
  let response=null;
  try{response=await fetch(f.url,{credentials:"include",redirect:"follow",cache:"no-store"});}catch{}
  if(!response?.ok){
   try{response=await fetch(f.url,{credentials:"omit",redirect:"follow",cache:"no-store"});}catch{}
  }
  if(!response?.ok)throw Error("Could not fetch "+f.name+(response?" (HTTP "+response.status+")":""));
  const bytes=new Uint8Array(await response.arrayBuffer());
  total+=bytes.byteLength;
  if(total>SIZE_LIMIT)throw Error("ZIP exceeds the 100 MB limit.");
  entries.push({name:f.name,bytes});
 }
 const archiveName=batchArchiveName();
 await saveBlob(makeZip(entries),archiveName,false);
 notice("Downloaded one ZIP archive: "+archiveName+" · "+entries.length+" file(s).");
}
$("download-zip").addEventListener("click",async()=>{
 const files=selectedFiles().length?selectedFiles():filtered();
 if(files.length<2)return;
 state.busy=true;updateCount();
 try{
  if(state.source==="gmail-visible"&&files.length===state.files.length){
   await downloadNativeGmailZip(files);
   return;
  }
  await requestZipPermissions(files);
  await mustHaveLicense();
  await downloadZipFiles(files);
 }catch(e){reportDownloadError("ZIP failed",e);}
 finally{state.busy=false;updateCount();}
});
async function detectGmail(){
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  $("gmail-controls").hidden=!tab?.url?.startsWith("https://mail.google.com/");
 }catch{}
}
async function initialize(){
 initPopupPdfTools({ensureAccess:mustHaveLicense});
 await Promise.allSettled([refreshAccount(),detectGmail()]);
 await restoreScanState().catch(()=>false);
 const saved=await chrome.storage.session.get("batchsaveWorkspaceTab").catch(()=>({}));
 setWorkspaceTab(saved.batchsaveWorkspaceTab||"downloads-panel");
}
initialize();

chrome.storage.local.get("batchsaveLastEmail").then(({batchsaveLastEmail})=>{if(!$("email").value&&batchsaveLastEmail)$("email").value=batchsaveLastEmail;}).catch(()=>{});
