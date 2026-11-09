import {scanVisibleGmailAttachments,downloadVisibleGmailAttachment,diagnoseVisibleGmailAttachments} from "../services/gmail-visible.js";
import {makeZip} from "../lib/zip.js";
import {batchFolder,batchArchiveName} from "../lib/download-batch.js";
import {classifyFile,filenameFromUrl,uniqueFiles,collectFromPage,isUsefulFile,isMeaningfulImage} from "../lib/files.js";
import {signUp,signOut,session,accountUser,entitlement,billingFunction} from "../services/auth.js";
import {signIn} from "../services/auth-login.js";
import {requestPasswordReset} from "../services/auth-recovery.js";
import {requestMagicLogin} from "../services/auth-magic.js";
import {configuredForGmail,gmailToken,listGmailAttachments,readGmailAttachment} from "../services/gmail.js";
const $=id=>document.getElementById(id);
$("version").textContent="v"+chrome.runtime.getManifest().version;
const state={files:[],selected:new Set(),source:"page",access:false,busy:false,googleReady:false};
const SIZE_LIMIT=100*1024*1024;
const fileKey=f=>f.id||f.url;
const isEmail=f=>f.source==="gmail"||f.source==="gmail-visible";
const IMAGE_NAME_RE=/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|[?#])/i;
const PDF_NAME_RE=/\.pdf(?:$|[?#])/i;
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
 if(file.source==="gmail"){
  const bytes=await readGmailAttachment(file);
  const url=URL.createObjectURL(new Blob([bytes],{type:file.mimeType||"application/octet-stream"}));
  previewBlobUrl=url;return url;
 }
 return file.url||"";
}
async function openPreview(file,button){
 closePreview();
 previewFocus=button;
 const dialog=$("preview-dialog"),image=$("preview-image"),frame=$("preview-frame"),details=$("preview-details"),error=$("preview-error");
 $("preview-title").textContent=file.name||"File preview";
 dialog.hidden=false;$("preview-close").focus();
 details.textContent=previewDetails(file);
 if(file.source==="gmail-visible"){
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
function notice(msg){$("status").textContent=msg;$("scan-feedback").textContent=msg;}
function authFeedback(msg,kind="info"){
 const box=$("auth-feedback");box.hidden=!msg;box.textContent=msg||"";box.dataset.kind=kind;
 if(msg)box.scrollIntoView({block:"nearest",behavior:"instant"});
}

const passwordInput=$("password");
function unlockPasswordInput(){
 passwordInput.readOnly=false;
 passwordInput.value="";
}
passwordInput.value="";
passwordInput.addEventListener("pointerdown",unlockPasswordInput,{once:true});
passwordInput.addEventListener("focus",unlockPasswordInput,{once:true});
setTimeout(()=>{if(passwordInput.readOnly)passwordInput.value="";},0);

function message(msg){$("account-status").textContent=msg;}
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
function updateCount(){
 const count=state.selected.size,available=!state.busy;
 $("selected").textContent=count+" selected";
 $("download").disabled=!count||!available;
 $("download").textContent=count>1?"Download ZIP ("+count+")":"Download file";
 $("download-zip").hidden=false;
 $("download-zip").disabled=!count||!available;
 $("clear-selection").disabled=!count||state.busy;
 $("select-all").disabled=!filtered().length||state.busy;
}
function render(){
 const shown=filtered(),target=$("results");target.replaceChildren();
 if(!shown.length){
  const empty=document.createElement("div");empty.className="empty";
  empty.textContent=isEmail({source:state.source})?"No visible attachments found in the open message.":"No matching files or substantive images.";
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
   checkbox.checked?state.selected.add(fileKey(f)):state.selected.delete(fileKey(f));updateCount();
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
   const fallback=document.createElement("span");fallback.className="preview-fallback";fallback.textContent="▧";
   fallback.hidden=!!f.url;image.hidden=!f.url;
   image.addEventListener("error",()=>{image.hidden=true;fallback.hidden=false;});
   if(f.url)image.src=f.url;
   trigger.append(image,fallback);
  }else{
   const symbol=document.createElement("span");symbol.className="preview-fallback";
   symbol.textContent=isPreviewablePdf(f)?"▤":isEmail(f)?"📎":"↓";
   trigger.append(symbol);
  }
  trigger.addEventListener("click",()=>openPreview(f,trigger));
  row.append(checkbox,trigger,meta);
  target.append(row);
 }
 $("count").textContent=shown.length+" shown · "+state.files.length+(isEmail({source:state.source})?" Gmail attachments":" page files");
 updateCount();
}
function showFiles(files,source){
 state.files=source==="page"?uniqueFiles(files):files;
 state.source=source;state.selected.clear();
 if(source==="gmail-visible"&&state.files.length===1)state.selected.add(fileKey(state.files[0]));
 $("search").disabled=false;$("type").disabled=false;$("type").value="relevant";render();
}
function displayProfile(user,plan){
 const identity=user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split("@")[0]||"BatchSave account";
 $("account-name").textContent=identity;
 $("account-avatar").textContent=identity.trim().charAt(0).toUpperCase()||"B";
 $("account-email").textContent=user?.email||"Email unavailable";
 $("account-license").textContent="Current plan: "+(plan||"Unavailable");
 $("account-details").hidden=false;
}
async function refreshAccount(){
 $("auth-form").hidden=true;$("billing-actions").hidden=true;$("account-details").hidden=true;
 let s;
 try{
  s=await session();
 }catch(e){
  state.access=false;message("Connection issue. Your login is saved; refresh when online.");
  updateCount();return;
 }
 if(!s){
  state.access=false;message("Sign in to manage downloads and your trial.");
  $("auth-form").hidden=false;updateCount();return;
 }
 const current=await accountUser().catch(()=>s.user||null);
 try{
  const info=await entitlement();
  state.access=!!info?.access_granted;
  const expires=info?.trial_ends_at?new Date(info.trial_ends_at).getTime():0;
  const remaining=expires-Date.now();
  const license=info?.subscription_status==="tester"?"Internal tester license":
    info?.subscription_status==="active"?"Pro subscription":
    info?.subscription_status==="trialing"?"3-day trial":
    info?.subscription_status||"No active subscription";
  displayProfile(current,license);
  message(state.access
   ?(info?.subscription_status==="tester"?"✓ Signed in · Tester access active":remaining>0?"✓ Signed in · Trial · "+Math.ceil(remaining/3600000)+"h left":"✓ Signed in · Pro active")
   :"✓ Signed in · Trial or subscription required");
  $("billing-actions").hidden=false;
  $("upgrade").hidden=state.access||["active","trialing"].includes(info?.subscription_status);
  $("manage").hidden=!info?.subscription_status||info.subscription_status==="tester";
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
  const bad=/invalid login credentials/i.test(e.message);
  if(bad){
   passwordInput.value="";
   passwordInput.readOnly=false;
   passwordInput.focus();
  }
  authFeedback(
   bad
    ?"Supabase rejected that password. The password field was cleared. Re-enter the current password, or choose Send reset email and use the newest reset message."
    :`Sign in failed: ${e.message}`,
   "error"
  );
 }finally{button.disabled=false;}
});
$("magic-login").addEventListener("click",async()=>{
 const email=$("email").value.trim();
 if(!email){authFeedback("Enter your email first, then choose Email sign-in link.","error");$("email").focus();return;}
 const button=$("magic-login");button.disabled=true;
 try{
  authFeedback("Sending a secure sign-in link…");
  await chrome.storage.local.set({batchsaveLastEmail:email});
  await requestMagicLogin(email);
  authFeedback("Sign-in link sent. Open the newest BatchSave Pro email and click the link. When the page says you are signed in, reopen this extension.","success");
  notice("Email sign-in link sent.");
 }catch(e){authFeedback("Could not send sign-in link: "+e.message,"error");}
 finally{button.disabled=false;}
});
$("register").addEventListener("click",async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||password.length<6){notice("Enter an email and password of at least 6 characters.");return;}
 $("register").disabled=true;
 try{
  authFeedback("Checking registration…");
  await signUp(email,password);
  passwordInput.value="";
  authFeedback("If this email is new, check your inbox and confirm it. If you already have an account, use Sign in or Send reset email instead of creating it again.","success");
  notice("Registration request processed. Existing accounts should use Sign in or Reset password.");
 }
 catch(e){authFeedback("Registration failed: "+e.message,"error");}finally{$("register").disabled=false;}
});
$("reset-password").addEventListener("click",async()=>{
 const email=$("email").value.trim();
 if(!email){authFeedback("Enter the email address used to create your BatchSave account, then choose Send reset email.","error");$("email").focus();return;}
 $("reset-password").disabled=true;
 try{
  authFeedback("Requesting password reset email…");
  await chrome.storage.local.set({batchsaveLastEmail:email});
  await requestPasswordReset(email);
  passwordInput.value="";
  passwordInput.readOnly=true;
  authFeedback("Reset request accepted. Check the inbox and spam folder of "+email+". Open the NEWEST password reset email, set a new password, and wait for “Password updated successfully”. Then reopen BatchSave Pro, click the password field, and type the NEW password.","success");
  notice("Password reset email sent. Use the newest message.");
 }
 catch(e){authFeedback("Password reset request failed: "+e.message,"error");}
 finally{$("reset-password").disabled=false;}
});
$("logout").addEventListener("click",async()=>{
 await signOut();state.selected.clear();authFeedback("");await refreshAccount();render();notice("Signed out.");
});
for(const [id,fn] of [["upgrade","create-checkout"],["manage","billing-portal"]]){
 $(id).addEventListener("click",async()=>{
  try{const url=await billingFunction(fn);await chrome.tabs.create({url});}
  catch(e){notice("Billing: "+e.message);}
 });
}
async function scanGmail(tabId){
 notice("Checking attachments in the open Gmail conversation…");
 const [{result:visible}]=await chrome.scripting.executeScript({target:{tabId},func:scanVisibleGmailAttachments});
 if(visible?.length){
   showFiles(visible,"gmail-visible");
   notice(visible.length+" attached file(s) found. Select 2+ to download one ZIP when Gmail exposes direct attachment URLs.");
   return;
 }
 // Do not retain stale files from a previous Gmail conversation.
 showFiles([],"gmail-visible");
 let diagnostic={cards:0,downloadDescriptors:0,namedNodes:0,filenameLabels:0};
 try{
  const [{result}]=await chrome.scripting.executeScript({target:{tabId},func:diagnoseVisibleGmailAttachments});
  if(result)diagnostic=result;
 }catch{}
 const detail=`Gmail markers: ${diagnostic.cards} attachment cards, ${diagnostic.downloadDescriptors} download descriptors, ${diagnostic.filenameLabels} filename labels.`;
 // Mailbox-wide scanning requires the official Google OAuth flow.

 if(!configuredForGmail()){
  notice("No attachment filenames recognized. "+detail+" For full mailbox scanning, Google OAuth is required.");
  $("gmail-setup").hidden=false;return;
 }
 notice("Connecting to Gmail…");
 // Interactive auth is called from the user's Scan button click.
 await gmailToken(true);
 notice("Reading real Gmail attachments…");
 const response=await listGmailAttachments({
  query:"has:attachment",
  maxResults:35,
  onProgress:(done,total)=>notice("Scanning Gmail messages "+done+"/"+total+"…")
 });
 showFiles(response.files,"gmail");
 notice(response.files.length+" Gmail attachments found in "+response.scannedMessages+" messages"+(response.nextPageToken?" (first page)":"")+".");
}
$("scan").addEventListener("click",async()=>{
 const button=$("scan");button.disabled=true;state.busy=true;updateCount();
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)throw Error("No active browser tab.");
  const gmail=tab.url?.startsWith("https://mail.google.com/");
  $("gmail-controls").hidden=!gmail;
  if(gmail){
   await scanGmail(tab.id);
  }else{
   notice("Scanning the current page…");
   const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:collectFromPage});
   const files=(result||[]).map(f=>({...f,kind:classifyFile(f.url,f.kind),name:f.name||filenameFromUrl(f.url)}));
   showFiles(files,"page");
   notice(filtered().length+" relevant files/photos detected.");
  }
 }catch(e){notice("Scan failed: "+e.message);}
 finally{button.disabled=false;state.busy=false;updateCount();}
});
$("search").addEventListener("input",render);
$("type").addEventListener("change",render);
$("select-all").addEventListener("click",()=>{
 for(const f of filtered())state.selected.add(fileKey(f));
 render();
});
$("clear-selection").addEventListener("click",()=>{state.selected.clear();render();});
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
  state.access=false;$("auth-form").hidden=false;
  throw Error("Sign in is required before downloading. Use Sign in or Email sign-in link.");
 }
 const e=await entitlement();
 state.access=!!e?.access_granted;
 if(!state.access)throw Error("Your trial, tester access or subscription is not active.");
 return e;
}
function reportDownloadError(prefix,error){
 const message=prefix+": "+(error?.message||String(error));
 notice(message);
 if(/sign in|required|license|trial|subscription|tester/i.test(message))authFeedback(message,"error");
}
$("download").addEventListener("click",async()=>{
 const files=selectedFiles();if(!files.length)return;
 state.busy=true;updateCount();
 try{
  if(files.length>1){
   await requestZipPermissions(files);
   await mustHaveLicense();
   await downloadZipFiles(files);
   return;
  }
  await mustHaveLicense();

  if(state.source==="gmail-visible"){
   const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
   if(!tab?.url?.startsWith("https://mail.google.com/"))throw Error("Open the Gmail message again.");
   const folder=batchFolder();
   let confirmed=0,unrouted=0;
   for(const f of files){
    notice("Preparing "+f.name+" in Downloads/"+folder+"…");
    const prior=await chrome.downloads.search({limit:100,orderBy:["-startTime"]});
    const known=new Set(prior.map(item=>item.id));
    const prep=await chrome.runtime.sendMessage({
     type:"PREPARE_GMAIL_DOWNLOAD",folder,expectedName:f.name
    });
    if(!prep?.ok)throw Error(prep?.error||"Cannot prepare Gmail destination folder.");
    try{
     const [{result}]=await chrome.scripting.executeScript({
      target:{tabId:tab.id},world:"MAIN",func:downloadVisibleGmailAttachment,
      args:[f.position,f.name]
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
     if(!detected)throw Error("Chrome did not start a download for "+f.name+". The Gmail Download control may be blocked.");
     confirmed++;
     if(!renamed)unrouted++;
     notice("Chrome started "+confirmed+"/"+files.length+" download(s).");
    }finally{
     await chrome.runtime.sendMessage({type:"CLEAR_GMAIL_FOLDER"}).catch(()=>{});
    }
   }
   notice(unrouted
    ?confirmed+" download(s) started, but "+unrouted+" could not be placed in the common folder. Check Chrome Downloads."
    :confirmed+" download(s) started in Downloads/"+folder+".");
  }else if(state.source==="gmail"){
   const folder=batchFolder();
   let completed=0;
   for(const f of files){
    notice("Downloading Gmail attachment "+(completed+1)+"/"+files.length+"…");
    const bytes=await readGmailAttachment(f);
    await saveBlob(new Blob([bytes],{type:f.mimeType||"application/octet-stream"}),folder+"/"+safeName(f.name));
    completed++;
   }
   notice("Started "+completed+" Gmail downloads in Downloads/"+folder+".");
  }else{
   const response=await chrome.runtime.sendMessage({type:"BATCH_DOWNLOAD",items:files.map(f=>({url:f.url,filename:f.name}))});
   if(!response?.ok)throw Error(response?.error||"Download failed");
   notice("Started "+response.started+" downloads in Downloads/"+response.folder+(response.failed?" · "+response.failed+" failed":"")+".");
  }
 }catch(e){reportDownloadError("Download failed",e);}
 finally{state.busy=false;updateCount();}
});
async function requestZipPermissions(files){
 if(state.source==="gmail")return;
 const missing=files.filter(f=>!f.url);
 if(missing.length)throw Error("These Gmail attachments do not expose a downloadable URL. Open the message and rescan, or configure Gmail OAuth for ZIP access.");
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
  let bytes;
  if(state.source==="gmail")bytes=await readGmailAttachment(f);
  else{
   if(!f.url)throw Error("No downloadable URL for "+f.name);
   let response;
   try{response=await fetch(f.url,{credentials:"include",redirect:"follow",cache:"no-store"});}catch{}
   if(!response?.ok){
    try{response=await fetch(f.url,{credentials:"omit",redirect:"follow",cache:"no-store"});}catch{}
   }
   if(!response?.ok)throw Error("Could not fetch "+f.name+(response?" (HTTP "+response.status+")":""));
   bytes=new Uint8Array(await response.arrayBuffer());
  }
  total+=bytes.byteLength;
  if(total>SIZE_LIMIT)throw Error("ZIP exceeds the 100 MB limit.");
  entries.push({name:f.name,bytes});
 }
 const archiveName=batchArchiveName();
 await saveBlob(makeZip(entries),archiveName,false);
 notice("Downloaded one ZIP archive: "+archiveName+" · "+entries.length+" file(s).");
}
$("download-zip").addEventListener("click",async()=>{
 const files=selectedFiles();if(!files.length)return;
 state.busy=true;updateCount();
 try{
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
refreshAccount();detectGmail();

chrome.storage.local.get("batchsaveLastEmail").then(({batchsaveLastEmail})=>{if(!$("email").value&&batchsaveLastEmail)$("email").value=batchsaveLastEmail;}).catch(()=>{});
