import {entitlement} from "../services/auth.js";
import {makeZip} from "../lib/zip.js";
import {configuredForGmail,gmailToken,disconnectGmail,listGmailAttachments,readGmailAttachment} from "../services/gmail.js";

const $=id=>document.getElementById(id);
const state={files:[],selected:new Set(),connected:false,licensed:false,nextPage:"",query:"",busy:false};
const LIMIT=100*1024*1024;
$("copy-id").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(chrome.runtime.id);googleStatus("Extension ID copied. Use this as Item ID when creating a Chrome Extension OAuth client.");}
 catch{googleStatus("Extension ID: "+chrome.runtime.id);}
});
function status(message){$("status").textContent=message;}
function googleStatus(message){$("google-status").textContent=message;}
function fileType(f){
 if(f.mimeType?.startsWith("image/"))return "image";
 if(f.mimeType==="application/pdf"||/\.pdf$/i.test(f.name))return "pdf";
 return "other";
}
function safeFilename(name){
 return (String(name||"file").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/^\.+/,"").slice(0,150))||"file";
}
function formatSize(bytes){
 if(!bytes)return "Size unknown";
 return bytes<1024*1024?Math.ceil(bytes/1024)+" KB":(bytes/1024/1024).toFixed(1)+" MB";
}
function displayed(){
 const type=$("filter").value;
 return state.files.filter(f=>type==="all"||fileType(f)===type);
}
function updateButtons(){
 const selected=state.selected.size;
 $("selected").textContent=selected+" selected";
 $("download").disabled=!selected||!state.licensed||state.busy;
 $("zip").disabled=!selected||!state.licensed||state.busy;
 $("toggle").disabled=!displayed().length||state.busy;
}
function render(){
 const shown=displayed(),container=$("files");
 container.replaceChildren();
 if(!shown.length){
   const div=document.createElement("div");div.className="empty";
   div.textContent=state.files.length?"No files matching this filter.":"No Gmail attachments found yet.";
   container.append(div);
 }
 for(const f of shown){
   const row=document.createElement("label");row.className="file";
   const input=document.createElement("input");input.type="checkbox";input.checked=state.selected.has(f.id);
   input.addEventListener("change",()=>{input.checked?state.selected.add(f.id):state.selected.delete(f.id);updateButtons();});
   const icon=document.createElement("span");icon.className="icon";icon.textContent=fileType(f)==="image"?"▧":fileType(f)==="pdf"?"▤":"📎";
   const meta=document.createElement("div");meta.className="meta";
   const name=document.createElement("div");name.className="file-name";name.textContent=f.name;
   const detail=document.createElement("div");detail.className="detail";detail.textContent=(f.subject||"(No subject)")+" · "+(f.from||"")+" · "+formatSize(f.size);
   const type=document.createElement("span");type.className="type";type.textContent=fileType(f).toUpperCase();
   meta.append(name,detail);row.append(input,icon,meta,type);container.append(row);
 }
 $("count").textContent=shown.length+" displayed · "+state.files.length+" attachments loaded";
 updateButtons();
}
async function license(){
 try{
   const data=await entitlement();
   state.licensed=Boolean(data?.access_granted);
   $("license").textContent=state.licensed
     ?"Active trial, tester access or subscription"
     :"No active trial or subscription. You can browse attachments, but downloads require a license.";
 }catch(e){state.licensed=false;$("license").textContent="Subscription check failed: "+e.message;}
 updateButtons();
}
$("check-license").addEventListener("click",license);
$("connect").addEventListener("click",async()=>{
 if(!configuredForGmail()){googleStatus("Google OAuth client ID not configured. Open the OAuth setup guide.");return;}
 $("connect").disabled=true;
 try{
   googleStatus("Waiting for Google authorization…");
   await gmailToken(true);state.connected=true;
   $("connect").hidden=true;$("disconnect").hidden=false;
   googleStatus("Connected. Your Gmail data stays in your browser.");
 }catch(e){googleStatus("Google sign-in failed: "+e.message);}
 finally{$("connect").disabled=false;}
});
$("disconnect").addEventListener("click",async()=>{
 await disconnectGmail();state.connected=false;state.files=[];state.selected.clear();state.nextPage="";
 $("connect").hidden=false;$("disconnect").hidden=true;$("more").hidden=true;
 googleStatus("Disconnected. Google token removed from Chrome cache.");render();
});
async function scan(append=false){
 if(!state.connected){googleStatus("Connect Gmail first.");return;}
 const query=$("query").value.trim()||"has:attachment";
 if(!append||query!==state.query){append=false;state.nextPage="";}
 $("scan").disabled=true;$("more").disabled=true;status("Searching Gmail for attachments…");
 try{
   const data=await listGmailAttachments({
     query,pageToken:append?state.nextPage:"",
     onProgress:(done,total)=>status("Reading "+done+"/"+total+" messages…")
   });
   state.query=query;state.nextPage=data.nextPageToken;
   state.files=append?[...state.files,...data.files]:data.files;
   state.files=state.files.filter((f,i,arr)=>arr.findIndex(x=>x.id===f.id)===i);
   if(!append)state.selected.clear();
   $("more").hidden=!state.nextPage;
   status("Found "+data.files.length+" attachments in "+data.scannedMessages+" messages"+(state.nextPage?" · more results available":"")+".");
   render();
 }catch(e){status("Gmail search failed: "+e.message);}
 finally{$("scan").disabled=false;$("more").disabled=false;}
}
$("scan").addEventListener("click",()=>scan());
$("more").addEventListener("click",()=>scan(true));
$("filter").addEventListener("change",render);
$("toggle").addEventListener("click",()=>{
 const shown=displayed(),all=shown.every(f=>state.selected.has(f.id));
 for(const f of shown)all?state.selected.delete(f.id):state.selected.add(f.id);
 render();
});
async function requireLicense(){
 const data=await entitlement();
 state.licensed=Boolean(data?.access_granted);
 updateButtons();
 if(!state.licensed)throw Error("Subscription or trial required to download.");
}
async function selectedFiles(){
 // The selection is based on trusted Gmail API IDs, not page HTML links.
 return state.files.filter(f=>state.selected.has(f.id));
}
async function saveBlob(blob,filename){
 const url=URL.createObjectURL(blob);
 try{
   await chrome.downloads.download({url,filename,conflictAction:"uniquify",saveAs:false});
 }finally{
   // Keep this tab open while Chrome begins the download.
   setTimeout(()=>URL.revokeObjectURL(url),120000);
 }
}
$("download").addEventListener("click",async()=>{
 const files=await selectedFiles();if(!files.length)return;
 state.busy=true;updateButtons();
 try{
   await requireLicense();
   let count=0;
   for(const f of files){
     status("Downloading "+(count+1)+"/"+files.length+": "+f.name);
     const bytes=await readGmailAttachment(f);
     await saveBlob(new Blob([bytes],{type:f.mimeType||"application/octet-stream"}),"BatchSave/Gmail/"+safeFilename(f.name));
     count++;
   }
   status("Started "+count+" Gmail downloads. Keep this tab open until they finish.");
 }catch(e){status("Download failed: "+e.message);}
 finally{state.busy=false;updateButtons();}
});
$("zip").addEventListener("click",async()=>{
 const files=await selectedFiles();if(!files.length)return;
 if(files.length>150){status("ZIP archives support at most 150 files.");return;}
 state.busy=true;updateButtons();
 try{
   await requireLicense();
   const entries=[];let total=0;
   for(const f of files){
     status("Preparing "+(entries.length+1)+"/"+files.length+": "+f.name);
     if(total+(f.size||0)>LIMIT)throw Error("ZIP archive exceeds the 100 MB limit.");
     const bytes=await readGmailAttachment(f);
     total+=bytes.byteLength;
     if(total>LIMIT)throw Error("ZIP archive exceeds the 100 MB limit.");
     entries.push({name:f.name,bytes});
   }
   const blob=makeZip(entries);
   await saveBlob(blob,"BatchSave/Gmail/gmail-attachments-"+new Date().toISOString().slice(0,10)+".zip");
   status("Started ZIP download with "+entries.length+" attachments.");
 }catch(e){status("ZIP failed: "+e.message);}
 finally{state.busy=false;updateButtons();}
});
if(!configuredForGmail()){
 $("connect").disabled=true;
 googleStatus("Google OAuth client ID is missing. Complete the OAuth setup guide to enable Gmail.");
}else{
 gmailToken(false).then(()=>{
   state.connected=true;$("connect").hidden=true;$("disconnect").hidden=false;
   googleStatus("Gmail already authorized. Find attachments to continue.");
 }).catch(()=>{});
}
license();render();
