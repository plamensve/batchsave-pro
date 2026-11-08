// Gmail API integration. Tokens and attachment contents are handled locally;
// no message bodies, attachment bytes, or tokens are sent to BatchSave servers.
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_SCOPE = SCOPE;
export function configuredForGmail(){
 const id=chrome.runtime.getManifest().oauth2?.client_id||"";
 return id.endsWith(".apps.googleusercontent.com")&&!id.startsWith("000000000000")&&!id.startsWith("REPLACE");
}
export async function gmailToken(interactive=false){
 if(!configuredForGmail())throw Error("Gmail OAuth client not configured. See docs/GMAIL_SETUP.md");
 const response=await chrome.identity.getAuthToken({interactive,scopes:[SCOPE]});
 const token=typeof response==="string"?response:response?.token;
 if(!token)throw Error("Google did not return an access token");
 return token;
}
export async function disconnectGmail(){
 try{
   const token=await gmailToken(false);
   await chrome.identity.removeCachedAuthToken({token});
   await fetch("https://oauth2.googleapis.com/revoke?token="+encodeURIComponent(token),{method:"POST"}).catch(()=>{});
 }catch{}
}
async function gmailFetch(path,{interactive=false}={}){
 let token=await gmailToken(interactive);
 const read=()=>fetch(API+path,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
 let response=await read();
 if(response.status===401){
   await chrome.identity.removeCachedAuthToken({token});
   token=await gmailToken(false);
   response=await read();
 }
 if(!response.ok){
   const error=await response.json().catch(()=>({}));
   throw Error(error.error?.message||"Gmail API returned HTTP "+response.status);
 }
 return response.json();
}
export function decodeBase64Url(input){
 if(typeof input!=="string")throw Error("Attachment has no data");
 const str=input.replace(/-/g,"+").replace(/_/g,"/");
 const pad="=".repeat((4-str.length%4)%4);
 const raw=atob(str+pad),array=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)array[i]=raw.charCodeAt(i);
 return array;
}
export function extractGmailAttachments(message){
 const results=[],subject=(message.payload?.headers||[]).find(h=>h.name?.toLowerCase()==="subject")?.value||"(No subject)";
 const from=(message.payload?.headers||[]).find(h=>h.name?.toLowerCase()==="from")?.value||"";
 const visit=(part,depth=0)=>{
   if(!part||depth>20)return;
   if(part.filename?.trim()){
     const body=part.body||{};
     if(body.attachmentId||body.data){
       results.push({
         id:"gmail:"+message.id+":"+(part.partId||results.length),
         source:"gmail",kind:"attachment",name:part.filename.trim(),
         mimeType:part.mimeType||"application/octet-stream",
         size:body.size||0,subject,from,messageId:message.id,
         attachmentId:body.attachmentId||null,inlineData:body.attachmentId?null:body.data
       });
     }
   }
   for(const child of part.parts||[])visit(child,depth+1);
 };
 visit(message.payload);
 return results;
}
export async function listGmailAttachments({query="has:attachment",pageToken="",maxResults=35,onProgress=()=>{}}={}){
 const params=new URLSearchParams({q:query||"has:attachment",maxResults:String(Math.min(maxResults,100))});
 if(pageToken)params.set("pageToken",pageToken);
 const list=await gmailFetch("/messages?"+params.toString(),{interactive:false});
 const msgs=list.messages||[],results=[];
 // Limited parallelism reduces Gmail quota/rate pressure.
 let cursor=0;
 const workers=Array.from({length:Math.min(4,msgs.length)},async()=>{
   while(cursor<msgs.length){
     const index=cursor++,message=msgs[index];
     try{
       const full=await gmailFetch("/messages/"+encodeURIComponent(message.id)+"?format=full");
       results.push(...extractGmailAttachments(full));
     }catch(e){
       // Do not silently misrepresent partial failures.
       throw Error("Could not read one Gmail message: "+e.message);
     }
     onProgress(cursor,msgs.length);
   }
 });
 await Promise.all(workers);
 return {files:results,nextPageToken:list.nextPageToken||"",scannedMessages:msgs.length};
}
export async function readGmailAttachment(file){
 if(file.source!=="gmail"||!file.messageId)throw Error("Not a Gmail attachment");
 const data=file.attachmentId?
  (await gmailFetch("/messages/"+encodeURIComponent(file.messageId)+"/attachments/"+encodeURIComponent(file.attachmentId))).data:
  file.inlineData;
 const bytes=decodeBase64Url(data);
 if(bytes.byteLength>100*1024*1024)throw Error("Attachment exceeds the 100 MB limit");
 return bytes;
}
