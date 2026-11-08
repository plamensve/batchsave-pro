import {scanVisibleGmailAttachments,downloadVisibleGmailAttachment,diagnoseVisibleGmailAttachments} from "../services/gmail-visible.js";
import {makeZip} from "../lib/zip.js";
import {batchFolder} from "../lib/download-batch.js";
import {classifyFile,filenameFromUrl,uniqueFiles,collectFromPage,isUsefulFile,isMeaningfulImage} from "../lib/files.js";
import {signUp,signIn,signOut,session,accountUser,entitlement,billingFunction,requestPasswordReset} from "../services/auth.js";
import {configuredForGmail,gmailToken,listGmailAttachments,readGmailAttachment} from "../services/gmail.js";
const $=id=>document.getElementById(id);
$("version").textContent="v"+chrome.runtime.getManifest().version;
const state={files:[],selected:new Set(),source:"page",access:false,busy:false,googleReady:false};
const SIZE_LIMIT=100*1024*1024;
const fileKey=f=>f.id||f.url;
const isEmail=f=>f.source==="gmail"||f.source==="gmail-visible";
function notice(msg){$("status").textContent=msg;$("scan-feedback").textContent=msg;}
function authFeedback(msg,kind="info"){
 const box=$("auth-feedback");box.hidden=!msg;box.textContent=msg||"";box.dataset.kind=kind;
 if(msg)box.scrollIntoView({block:"nearest",behavior:"instant"});
}

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
 $("selected").textContent=state.selected.size+" selected";
 $("download").disabled=!state.selected.size||!state.access||state.busy;
 $("download-zip").hidden=state.source==="gmail-visible";
 $("download").textContent=state.source==="gmail-visible"?"Download selected":"Download files";
 $("download-zip").disabled=!state.selected.size||!state.access||state.busy||state.source==="gmail-visible";
}
function render(){
 const shown=filtered(),target=$("results");target.replaceChildren();
 if(!shown.length){
  const empty=document.createElement("div");empty.className="empty";
  empty.textContent=isEmail({source:state.source})?"No visible attachments found in the open message.":"No matching files or substantive images.";
  target.append(empty);
 }
 for(const f of shown){
  const row=document.createElement("label");row.className="file";
  row.title=isEmail(f)?(f.subject||f.name):f.url;
  const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=state.selected.has(fileKey(f));
  checkbox.addEventListener("change",()=>{
   checkbox.checked?state.selected.add(fileKey(f)):state.selected.delete(fileKey(f));updateCount();
  });
  const symbol=document.createElement("span");symbol.className="file-icon";
  symbol.textContent=isEmail(f)?"📎":typeOf(f)==="image"?"▧":typeOf(f)==="pdf"?"▤":"↓";
  const meta=document.createElement("span");meta.className="file-meta";
  const title=document.createElement("div");title.className="file-name";title.textContent=f.name;
  const desc=document.createElement("div");desc.className="file-sub";
  desc.textContent=isEmail(f)?(f.subject||"(No subject)")+" · "+(f.source==="gmail-visible"?"Native Gmail download":f.size?Math.ceil(f.size/1024)+" KB":"Gmail"):(new URL(f.url).hostname+" · "+typeOf(f).toUpperCase());
  meta.append(title,desc);row.append(checkbox,symbol,meta);target.append(row);
 }
 $("count").textContent=shown.length+" shown · "+state.files.length+(isEmail({source:state.source})?" Gmail attachments":" page files");
 $("select-all").disabled=shown.length===0;
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
  authFeedback(bad?"Supabase rejected these credentials. Check the email and password, or choose Reset password.":`Sign in failed: ${e.message}`,"error");
 }finally{button.disabled=false;}
});
$("register").addEventListener("click",async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||password.length<6){notice("Enter an email and password of at least 6 characters.");return;}
 $("register").disabled=true;
 try{authFeedback("Creating account…");await signUp(email,password);authFeedback("Account created. Confirm your email and return to Sign in.","success");notice("Check your email, confirm the address, then Sign in.");}
 catch(e){authFeedback("Registration failed: "+e.message,"error");}finally{$("register").disabled=false;}
});
$("reset-password").addEventListener("click",async()=>{
 const email=$("email").value.trim();
 if(!email){authFeedback("Enter the email address used to create your BatchSave account, then choose Send reset email.","error");$("email").focus();return;}
 $("reset-password").disabled=true;
 try{authFeedback("Requesting password reset email…");await chrome.storage.local.set({batchsaveLastEmail:email});await requestPasswordReset(email);authFeedback("Reset request accepted. Check the inbox and spam folder of "+email+". Open the newest password reset email, choose a new password, then sign in.","success");notice("Password reset request accepted.");}
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
   notice(visible.length+" attached file(s) found. Click Download selected to save them with Gmail.");
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
 const shown=filtered(),all=shown.every(f=>state.selected.has(fileKey(f)));
 for(const f of shown)all?state.selected.delete(fileKey(f)):state.selected.add(fileKey(f));
 render();
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
 const e=await entitlement();
 state.access=!!e?.access_granted;
 if(!state.access)throw Error("Your trial or subscription is not active.");
}
$("download").addEventListener("click",async()=>{
 const files=selectedFiles();if(!files.length)return;
 state.busy=true;updateCount();
 try{
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
 }catch(e){notice("Download failed: "+e.message);}
 finally{state.busy=false;updateCount();}
});
$("download-zip").addEventListener("click",async()=>{
 const files=selectedFiles();
 if(!files.length)return;
 if(state.source==="gmail-visible"){notice("ZIP of Gmail attachments requires Google OAuth. Use Download files for this open message.");return;}
 if(files.length>150){notice("ZIP supports up to 150 files.");return;}
 if(state.source!=="gmail"){
  const origins=[...new Set(files.map(f=>new URL(f.url).origin+"/*"))];
  try{if(!await chrome.permissions.request({origins}))throw Error("Site permission denied");}
  catch(e){notice("ZIP permissions: "+e.message);return;}
 }
 state.busy=true;updateCount();
 try{
  await mustHaveLicense();
  const entries=[];let total=0;
  for(const f of files){
   notice("Preparing ZIP "+(entries.length+1)+"/"+files.length+": "+f.name);
   if(total+(f.size||0)>SIZE_LIMIT)throw Error("ZIP exceeds 100 MB limit.");
   let bytes;
   if(state.source==="gmail")bytes=await readGmailAttachment(f);
   else{
    const r=await fetch(f.url,{credentials:"include"});
    if(!r.ok)throw Error("HTTP "+r.status+" for "+f.name);
    bytes=new Uint8Array(await r.arrayBuffer());
   }
   total+=bytes.byteLength;
   if(total>SIZE_LIMIT)throw Error("ZIP exceeds 100 MB limit.");
   entries.push({name:f.name,bytes});
  }
  await saveBlob(makeZip(entries),batchFolder()+"/files.zip",true);
  notice("ZIP ready: "+entries.length+" files.");
 }catch(e){notice("ZIP failed: "+e.message);}
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
