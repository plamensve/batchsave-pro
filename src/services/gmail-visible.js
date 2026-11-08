// Best-effort access to attachments shown in the open Gmail message.
// No cookies, hidden Gmail endpoints or mailbox-wide access.
export function scanVisibleGmailAttachments() {
  const subject=document.querySelector("h2.hP")?.textContent?.trim()||"Open Gmail message";
  const nodes=[...document.querySelectorAll(".aZo,[download_url],[data-attachment-id],[data-attachment-name]")];
  const allowed=/\.(?:pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|jpe?g|png|gif|webp|heic|bmp|xml|json|eml|msg|mp3|mp4)$/i;
  const decode=value=>{
    let v=String(value||"").trim().replace(/[\u200b-\u200d\ufeff]/g,"");
    for(let i=0;i<2&&/%[0-9a-f]{2}/i.test(v);i++){
      try{v=decodeURIComponent(v);}catch{break;}
    }
    return v;
  };
  const filename=(node,card)=>{
    const downloadMeta=card.getAttribute?.("download_url")||
      card.querySelector?.("[download_url]")?.getAttribute?.("download_url")||
      node.getAttribute?.("download_url")||"";
    // Gmail has used MIME:type:encoded-filename:attachment-id.
    // Extract the filename segment; never greedily include the attachment ID.
    const parts=downloadMeta.split(":");
    const candidates=[
      card.getAttribute?.("data-attachment-name"),
      node.getAttribute?.("data-attachment-name"),
      ...parts.slice(1),
      card.querySelector?.(".aV3,.aQy")?.textContent,
      node.querySelector?.(".aV3,.aQy")?.textContent,
      card.getAttribute?.("title"),
      node.getAttribute?.("title")
    ];
    for(const raw of candidates){
      const name=decode(raw);
      if(name&&name.length<=200&&allowed.test(name))return name;
    }
    return "";
  };
  const seen=new Set(),results=[];
  for(let i=0;i<nodes.length;i++){
    const node=nodes[i],card=node.closest?.(".aZo")||node;
    if(!card||seen.has(card)||card.isConnected===false)continue;
    const name=filename(node,card);
    if(!name)continue;
    seen.add(card);
    results.push({id:"visible:"+i,source:"gmail-visible",kind:"attachment",
      name,subject,position:i});
  }
  return results;
}
export function downloadVisibleGmailAttachment(position,expectedName) {
  const nodes=[...document.querySelectorAll(".aZo,[download_url],[data-attachment-id],[data-attachment-name]")];
  const node=nodes[position],card=node?.closest?.(".aZo")||node;
  if(!card||card.isConnected===false)return {ok:false,error:"Attachment changed. Scan the open message again."};
  const decode=value=>{
    let v=String(value||"").trim();
    for(let i=0;i<2&&/%[0-9a-f]{2}/i.test(v);i++){
      try{v=decodeURIComponent(v);}catch{break;}
    }
    return v;
  };
  const raw=card.getAttribute?.("download_url")||
    card.querySelector?.("[download_url]")?.getAttribute?.("download_url")||
    node.getAttribute?.("download_url")||"";
  const parts=raw.split(":");
  const candidates=[...parts.slice(1),
    card.getAttribute?.("data-attachment-name"),
    node.getAttribute?.("data-attachment-name"),
    card.querySelector?.(".aV3,.aQy")?.textContent,
    node.querySelector?.(".aV3,.aQy")?.textContent].map(decode);
  if(!expectedName||!candidates.includes(expectedName)){
    return {ok:false,error:"Attachment identity cannot be verified. Scan again before downloading."};
  }
  // Clicking Gmail's own Download button is best effort, not an API download.
  const selectors=[
    '[data-tooltip="Download"]','[aria-label="Download"]',
    '[data-tooltip*="Download"]','[aria-label*="Download"]',
    '.aQK'
  ];
  let button=null;
  for(const selector of selectors){
    button=card.querySelector?.(selector);
    if(button)break;
  }
  if(!button||button.disabled)return {ok:false,error:"No usable Gmail Download button is available for this attachment."};
  button.click();
  return {ok:true,triggered:true};
}
