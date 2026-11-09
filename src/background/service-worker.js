import {entitlement} from "../services/auth.js";
import {batchFolder,isBatchFolder,safeFileName,matchesGmailIntent} from "../lib/download-batch.js";

const GMAIL_INTENT="gmailBatchIntent";
let licenseCache=null;
async function checkedEntitlement(){
 if(licenseCache&&Date.now()<licenseCache.expiresAt)return licenseCache.value;
 const value=await entitlement();
 licenseCache={value,expiresAt:Date.now()+5000};
 return value;
}
// A short-lived, narrowly scoped request. Never rename arbitrary browser downloads.
chrome.downloads.onDeterminingFilename.addListener((item,suggest)=>{
 chrome.storage.session.get(GMAIL_INTENT).then(async state=>{
  const intent=state[GMAIL_INTENT];
  if(!matchesGmailIntent(item,intent)){
   suggest();return;
  }
  // Record the match before suggesting so a reopened popup can inspect the result.
  await chrome.storage.session.set({[GMAIL_INTENT]:{...intent,handled:true,downloadId:item.id}});
  suggest({filename:intent.folder+"/"+safeFileName(intent.expectedName),conflictAction:"uniquify"});
 }).catch(()=>suggest());
 return true;
});

async function onMessage(message){
 if(message?.type==="CHECK_LICENSE"){
  const access=await checkedEntitlement();
  return {ok:true,entitlement:access||null,access_granted:!!access?.access_granted};
 }
 if(message?.type==="GET_GMAIL_FOLDER_STATE"){
  const state=await chrome.storage.session.get(GMAIL_INTENT);
  const intent=state[GMAIL_INTENT]||null;
  return {ok:true,handled:!!intent?.handled,downloadId:intent?.downloadId??null,folder:intent?.folder||null};
 }
 if(message?.type==="CLEAR_GMAIL_FOLDER"){
  await chrome.storage.session.remove(GMAIL_INTENT);
  return {ok:true};
 }
 if(message?.type==="PREPARE_GMAIL_DOWNLOAD"){
  const access=await checkedEntitlement();
  if(!access?.access_granted)return {ok:false,error:"No active license."};
  if(!isBatchFolder(message.folder))return {ok:false,error:"Invalid batch folder."};
  const expectedName=safeFileName(message.expectedName);
  if(!expectedName||expectedName==="download")return {ok:false,error:"Missing attachment filename."};
  await chrome.storage.session.set({[GMAIL_INTENT]:{
   folder:message.folder,expectedName,handled:false,
   createdAt:Date.now(),expiresAt:Date.now()+25000
  }});
  return {ok:true};
 }
 if(message?.type==="BATCH_DOWNLOAD"){
  const access=await checkedEntitlement();
  if(!access?.access_granted)return {ok:false,error:"Trial expired or no active subscription."};
  const items=Array.isArray(message.items)?message.items.slice(0,3000):[];
  if(!items.length)return {ok:false,error:"No files selected"};
  const folder=batchFolder();
  let started=0,failed=0,errors=[];
  for(const item of items){
   try{
    const u=new URL(item.url);
    if(!["http:","https:"].includes(u.protocol))throw Error("Invalid URL");
    const filename=safeFileName(item.filename||"download");
    await chrome.downloads.download({
     url:u.href,filename:folder+"/"+filename,conflictAction:"uniquify",saveAs:false
    });
    started++;
   }catch(error){failed++;if(errors.length<3)errors.push(error.message||String(error));}
  }
  return {ok:started>0,started,failed,folder,errors,error:started?"":errors[0]||"No downloads could be started."};
 }
 return {ok:false,error:"Unknown message"};
}
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
 if(!["CHECK_LICENSE","GET_GMAIL_FOLDER_STATE","CLEAR_GMAIL_FOLDER","PREPARE_GMAIL_DOWNLOAD","BATCH_DOWNLOAD"].includes(message?.type))return false;
 onMessage(message).then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message}));
 return true;
});
