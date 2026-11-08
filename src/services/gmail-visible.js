// Runs inside the currently open Gmail tab via chrome.scripting.executeScript.
// Only reports visible attachment metadata. It cannot read mailbox data or bypass Gmail.
export function scanVisibleGmailAttachments(){
 const subject=document.querySelector("h2.hP")?.textContent?.trim()||"Current Gmail conversation";
 const selectors=".aZo, [download_url], [data-attachment-id], [data-attachment-name]";
 const candidates=[...document.querySelectorAll(selectors)];
 const cards=[];
 const filePattern=/[\wÀ-ÿА-Яа-я][^\/\\<>:"|?*\r\n]{0,180}\.(?:pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|jpe?g|png|gif|webp|heic|bmp|xml|json|eml|msg|mp3|mp4)$/i;
 function nameOf(el){
   const metadata=el.getAttribute("download_url")||"";
   const chunks=metadata.split(":");
   const downloadName=chunks.length>=3?chunks[1]:"";
   const values=[el.getAttribute("data-attachment-name"),downloadName,
     el.querySelector(".aV3, .aQy, [data-tooltip]")?.textContent,
     el.getAttribute("aria-label"),el.getAttribute("title")];
   for(const val of values){
     if(!val)continue;
     const str=val.trim();
     if(filePattern.test(str))return str.slice(0,180);
   }
   return "";
 }
 for(const el of candidates){
   if(cards.some(card=>card.contains(el)))continue;
   const container=el.closest(".aZo")||el;
   if(!container.isConnected)continue;
   const name=nameOf(el)||nameOf(container);
   if(!name)continue;
   if(cards.some(card=>card===container))continue;
   cards.push(container);
 }
 return cards.map((el,index)=>{
   const name=nameOf(el)||"attachment";
   return {id:"visible:"+index,source:"gmail-visible",kind:"attachment",
     name,subject,position:index,hasNativeDownload:Boolean(el.querySelector('[aria-label*="Download"],[data-tooltip*="Download"],.aQK'))};
 });
}
// Called separately for each selected file. Resolves the card again to avoid stale nodes.
export function downloadVisibleGmailAttachment(position){
 const nodes=[...document.querySelectorAll(".aZo, [download_url], [data-attachment-id], [data-attachment-name]")];
 const cards=[];
 for(const el of nodes){
  if(cards.some(card=>card.contains(el)))continue;
  const card=el.closest(".aZo")||el;
  if(!card.isConnected||cards.includes(card))continue;
  const value=card.getAttribute("download_url")||el.getAttribute("download_url")||"";
  const text=[value,card.querySelector(".aV3,.aQy")?.textContent,card.getAttribute("data-attachment-name")].filter(Boolean).join(" ");
  if(!/\.(?:pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|jpe?g|png|gif|webp|heic|bmp|xml|json|eml|msg|mp3|mp4)(?:\s|:|$)/i.test(text))continue;
  cards.push(card);
 }
 const card=cards[position];
 if(!card)return {ok:false,error:"Attachment has moved. Scan the message again."};
 const button=card.querySelector('[data-tooltip="Download"],[aria-label="Download"],[data-tooltip*="Download"],[aria-label*="Download"],.aQK');
 if(!button)return {ok:false,error:"Gmail did not expose a native Download button for this attachment."};
 button.click();
 return {ok:true};
}
