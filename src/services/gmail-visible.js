// Gmail's visible attachment UI, accessed only on the open Gmail tab.
// This is an optional best-effort path; full mailbox access uses the official API.
export function scanVisibleGmailAttachments(){
 const subject=document.querySelector("h2.hP")?.textContent?.trim()||"Open Gmail message";
 const selectors=".aZo, [download_url], [data-attachment-id], [data-attachment-name]";
 const nodes=[...document.querySelectorAll(selectors)],seen=new Set(),results=[];
 const extension=/\.(?:pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|jpe?g|png|gif|webp|heic|bmp|xml|json|eml|msg|mp3|mp4)$/i;
 const clean=(s)=>{
  if(typeof s!=="string")return "";
  let text=s.trim();
  try{text=decodeURIComponent(text);}catch{}
  return text;
 };
 const nameOf=el=>{
  const raw=el.getAttribute?.("download_url")||"";
  const fromDownload=raw.match(/^[^:]+:(.+):[^:]+$/)?.[1]||"";
  const candidates=[
   el.getAttribute?.("data-attachment-name"),
   fromDownload,
   el.querySelector?.(".aV3,.aQy")?.textContent,
   el.getAttribute?.("title"),
   el.getAttribute?.("aria-label")
  ];
  for(const rawName of candidates){
   const value=clean(rawName);
   if(value&&extension.test(value))return value.slice(0,180);
  }
  return "";
 };
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i],card=node.closest?.(".aZo")||node;
  if(!card?.isConnected||seen.has(card))continue;
  const name=nameOf(card)||nameOf(node);
  if(!name)continue;
  seen.add(card);
  results.push({id:"visible:"+i,source:"gmail-visible",kind:"attachment",name,subject,
    position:i,hasNativeDownload:true});
 }
 return results;
}
export function downloadVisibleGmailAttachment(position,expectedName){
 const nodes=[...document.querySelectorAll(".aZo, [download_url], [data-attachment-id], [data-attachment-name]")];
 const node=nodes[position],card=node?.closest?.(".aZo")||node;
 if(!card||!card.isConnected)return {ok:false,error:"The email changed. Scan it again."};
 const raw=(card.getAttribute?.("download_url")||node.getAttribute?.("download_url")||"");
 let meta=raw+" "+(card.querySelector?.(".aV3,.aQy")?.textContent||"");
 try{meta=decodeURIComponent(meta);}catch{}
 if(expectedName && !meta.includes(expectedName)){
   const current=card.getAttribute?.("data-attachment-name")||"";
   if(current!==expectedName)return {ok:false,error:"The selected attachment changed. Scan again."};
 }
 const selectors=[
  '[data-tooltip="Download"]',
  '[aria-label="Download"]',
  '[data-tooltip*="Download"]',
  '[aria-label*="Download"]',
  '.aQK'
 ];
 let button=null;
 for(const selector of selectors){
  button=card.querySelector?.(selector);
  if(button)break;
 }
 if(!button)return {ok:false,error:"Gmail has no accessible Download button on this attachment. Open the message and use Gmail's Download control."};
 button.click();
 return {ok:true,triggered:true};
}
