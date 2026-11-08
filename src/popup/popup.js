import {makeZip} from "../lib/zip.js";
import {classifyFile,filenameFromUrl,uniqueFiles,collectFromPage,isUsefulFile,isMeaningfulImage} from "../lib/files.js";
import {signUp,signIn,signOut,session,entitlement,billingFunction,requestPasswordReset} from "../services/auth.js";
import {configuredForGmail,gmailToken,listGmailAttachments,readGmailAttachment} from "../services/gmail.js";
const $=id=>document.getElementById(id);
const state={files:[],selected:new Set(),source:"page",access:false,busy:false,googleReady:false};
const SIZE_LIMIT=100*1024*1024;
const fileKey=f=>f.id||f.url;
const isEmail=f=>f.source==="gmail";
function notice(msg){$("status").textContent=msg;}
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
    (type==="other"&&typeOf(f)==="other");
  return show&&(!search||[f.name,f.subject||"",f.from||"",f.url||""].some(s=>s.toLowerCase().includes(search)));
 });
}
function updateCount(){
 $("selected").textContent=state.selected.size+" selected";
 $("download").disabled=!state.selected.size||!state.access||state.busy;
 $("download-zip").disabled=!state.selected.size||!state.access||state.busy;
}
function render(){
 const shown=filtered(),target=$("results");target.replaceChildren();
 if(!shown.length){
  const empty=document.createElement("div");empty.className="empty";
  empty.textContent=state.source==="gmail"?"No attachments matched. Try a different Gmail search.":"No matching files or substantive images.";
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
  desc.textContent=isEmail(f)?(f.subject||"(No subject)")+" · "+(f.size?Math.ceil(f.size/1024)+" KB":"Gmail"):(new URL(f.url).hostname+" · "+typeOf(f).toUpperCase());
  meta.append(title,desc);row.append(checkbox,symbol,meta);target.append(row);
 }
 $("count").textContent=shown.length+" shown · "+state.files.length+(state.source==="gmail"?" Gmail attachments":" page files");
 $("select-all").disabled=shown.length===0;
 updateCount();
}
function showFiles(files,source){
 state.files=source==="page"?uniqueFiles(files):files;
 state.source=source;state.selected.clear();
 $("search").disabled=false;$("type").disabled=false;$("type").value="relevant";render();
}
async function refreshAccount(){
 $("auth-form").hidden=true;$("billing-actions").hidden=true;
 try{
  const s=await session();
  if(!s){
   state.access=false;
   message("Sign in to manage downloads and your trial.");
   $("auth-form").hidden=false;updateCount();return;
  }
  const entitlementInfo=await entitlement();
  state.access=!!entitlementInfo?.access_granted;
  const expires=entitlementInfo?.trial_ends_at?new Date(entitlementInfo.trial_ends_at).getTime():0;
  const remaining=expires-Date.now();
  message(state.access
   ?(entitlementInfo.subscription_status==="tester"?"Internal testing access active":remaining>0?"Trial active · "+Math.ceil(remaining/3600000)+" hours left":"Pro subscription active")
   :"Signed in · start your 3-day trial to download");
  $("billing-actions").hidden=false;
  $("upgrade").hidden=state.access||["active","trialing"].includes(entitlementInfo?.subscription_status);
  $("manage").hidden=!entitlementInfo?.subscription_status||entitlementInfo.subscription_status==="tester";
 }catch(e){
  state.access=false;
  message("Signed in, but license validation failed: "+e.message);
  $("billing-actions").hidden=false;
  $("manage").hidden=true;
 }
 updateCount();
}
$("auth-form").addEventListener("submit",async ev=>{
 ev.preventDefault();
 const button=$("login");button.disabled=true;
 try{
  await signIn($("email").value.trim(),$("password").value);
  notice("Signed in successfully.");await refreshAccount();
 }catch(e){
  const bad=/invalid login credentials/i.test(e.message);
  notice(bad?"Wrong email or password. Use Reset password if needed.":e.message);
 }finally{button.disabled=false;}
});
$("register").addEventListener("click",async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||password.length<6){notice("Enter an email and password of at least 6 characters.");return;}
 $("register").disabled=true;
 try{await signUp(email,password);notice("Check your email, confirm the address, then Sign in.");}
 catch(e){notice("Registration failed: "+e.message);}finally{$("register").disabled=false;}
});
$("reset-password").addEventListener("click",async()=>{
 const email=$("email").value.trim();
 if(!email){notice("Enter your email address to reset the password.");return;}
 $("reset-password").disabled=true;
 try{await requestPasswordReset(email);notice("If the account exists, a password reset email will arrive shortly.");}
 catch(e){notice("Password reset failed: "+e.message);}
 finally{$("reset-password").disabled=false;}
});
$("logout").addEventListener("click",async()=>{
 await signOut();state.selected.clear();await refreshAccount();render();notice("Signed out.");
});
for(const [id,fn] of [["upgrade","create-checkout"],["manage","billing-portal"]]){
 $(id).addEventListener("click",async()=>{
  try{const url=await billingFunction(fn);await chrome.tabs.create({url});}
  catch(e){notice("Billing: "+e.message);}
 });
}
async function scanGmail(){
 if(!configuredForGmail()){
  notice("Gmail needs a Google OAuth client ID. Complete the setup in Google Cloud; see Gmail setup link.");
  $("gmail-setup").hidden=false;return;
 }
 notice("Connecting to Gmail…");
 // Interactive auth is called from the user's Scan button click.
 await gmailToken(true);
 notice("Reading real Gmail attachments…");
 const response=await listGmailAttachments({
  query:$("gmail-query").value.trim()||"has:attachment",
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
   await scanGmail();
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
  if(state.source==="gmail"){
   let completed=0;
   for(const f of files){
    notice("Downloading Gmail attachment "+(completed+1)+"/"+files.length+"…");
    const bytes=await readGmailAttachment(f);
    await saveBlob(new Blob([bytes],{type:f.mimeType||"application/octet-stream"}),"BatchSave/Gmail/"+safeName(f.name));
    completed++;
   }
   notice("Started "+completed+" Gmail attachment downloads. Keep this popup open until complete.");
  }else{
   const response=await chrome.runtime.sendMessage({type:"BATCH_DOWNLOAD",items:files.map(f=>({url:f.url,filename:f.name}))});
   if(!response?.ok)throw Error(response?.error||"Download failed");
   notice("Started "+response.started+" downloads"+(response.failed?" · "+response.failed+" failed":"")+".");
  }
 }catch(e){notice("Download failed: "+e.message);}
 finally{state.busy=false;updateCount();}
});
$("download-zip").addEventListener("click",async()=>{
 const files=selectedFiles();
 if(!files.length)return;
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
  await saveBlob(makeZip(entries),"BatchSave/"+(state.source==="gmail"?"gmail-":"")+"files-"+new Date().toISOString().slice(0,10)+".zip",true);
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
