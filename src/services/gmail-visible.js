// Experimental Gmail visible-attachment integration.
// Runs only on the open Gmail tab; no private endpoints, cookies or email content leaves the tab.
export function scanVisibleGmailAttachments() {
  const subject=document.querySelector("h2.hP")?.textContent?.trim()||"Open Gmail message";
  const nodes=[...document.querySelectorAll(".aZo,[download_url],[data-attachment-id],[data-attachment-name]")];
  const allowed=/\.(?:pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|jpe?g|png|gif|webp|heic|bmp|xml|json|eml|msg|mp3|mp4)$/i;
  const decode=value=>{
    let v=String(value||"").trim().replace(/[\u200b-\u200d\ufeff]/g,"");
    for(let i=0;i<2&&/%[0-9a-f]{2}/i.test(v);i++){try{v=decodeURIComponent(v);}catch{break;}}
    return v;
  };
  const filename=(node,card)=>{
    const raw=card.getAttribute?.("download_url")||
      card.querySelector?.("[download_url]")?.getAttribute?.("download_url")||
      node.getAttribute?.("download_url")||"";
    const parts=raw.split(":");
    const candidates=[
      card.getAttribute?.("data-attachment-name"),
      node.getAttribute?.("data-attachment-name"),
      ...parts.slice(1),
      card.querySelector?.(".aV3,.aQy")?.textContent,
      node.querySelector?.(".aV3,.aQy")?.textContent,
      card.getAttribute?.("title"),
      node.getAttribute?.("title")
    ];
    for(const candidate of candidates){
      const name=decode(candidate);
      if(name&&name.length<=200&&allowed.test(name))return name;
    }
    return "";
  };
  const seen=new Set(),results=[];
  for(let index=0;index<nodes.length;index++){
    const node=nodes[index],card=node.closest?.(".aZo")||node;
    if(!card||card.isConnected===false||seen.has(card))continue;
    const name=filename(node,card);
    if(!name)continue;
    const raw=card.getAttribute?.("download_url")||
      card.querySelector?.("[download_url]")?.getAttribute?.("download_url")||
      node.getAttribute?.("download_url")||"";
    const urlMatch=raw.match(/https?:\/\/.+$/i);
    const url=urlMatch?.[0]||"";
    seen.add(card);
    results.push({id:"visible:"+index,source:"gmail-visible",kind:"attachment",name,subject,position:index,url});
  }
  return results;
}

export async function downloadVisibleGmailAttachment(position,expectedName) {
  // Chrome scripting serializes this function and calls it inside the Gmail page.
  const nodes=[...document.querySelectorAll(".aZo,[download_url],[data-attachment-id],[data-attachment-name]")];
  const node=nodes[position],card=node?.closest?.(".aZo")||node;
  if(!card||card.isConnected===false)return {ok:false,error:"The Gmail message changed. Scan again."};
  const decode=value=>{
    let v=String(value||"").trim();
    for(let i=0;i<2&&/%[0-9a-f]{2}/i.test(v);i++){try{v=decodeURIComponent(v);}catch{break;}}
    return v;
  };
  const meta=card.getAttribute?.("download_url")||
    card.querySelector?.("[download_url]")?.getAttribute?.("download_url")||
    node.getAttribute?.("download_url")||"";
  const parts=meta.split(":");
  const names=[...parts.slice(1),card.getAttribute?.("data-attachment-name"),
    node.getAttribute?.("data-attachment-name"),
    card.querySelector?.(".aV3,.aQy")?.textContent,
    node.querySelector?.(".aV3,.aQy")?.textContent].map(decode);
  if(!expectedName||!names.includes(expectedName)){
    return {ok:false,error:"The selected filename no longer matches Gmail. Scan again."};
  }
  const targets=[card,card.parentElement].filter(Boolean);
  // Gmail shows its download overlay when a user hovers an attachment.
  for(const target of targets){
    try{
      const events=["pointerover","mouseover","mouseenter"];
      for(const name of events){
        const ctor=name.startsWith("pointer")&&typeof PointerEvent==="function"?PointerEvent:MouseEvent;
        target.dispatchEvent(new ctor(name,{bubbles:name!=="mouseenter",cancelable:true,view:window}));
      }
    }catch{}
  }
  await new Promise(resolve=>setTimeout(resolve,120));

  const isDownload=el=>{
    if(el.disabled||el.getAttribute?.("aria-disabled")==="true")return false;
    const value=["aria-label","data-tooltip","title","data-original-title"].map(k=>el.getAttribute?.(k)||"").join(" ").toLowerCase();
    return /(download|изтегля|сваля|изтегли|свали|herunterladen|télécharger|descargar|scarica|скачать)/i.test(value);
  };
  const matches=[];
  for(const scope of targets){
    const items=[...scope.querySelectorAll?.("button,[role='button'],[data-tooltip],[aria-label],a[href]")||[]];
    for(const item of items)if(isDownload(item)&&!matches.includes(item))matches.push(item);
    if(matches.length)break;
  }
  // Old Gmail attachment layouts sometimes use this download overlay class.
  if(!matches.length){
    const overlay=card.querySelector?.(".aQK");
    if(overlay&&!overlay.disabled)matches.push(overlay);
  }
  if(!matches.length){
    return {ok:false,error:"No Gmail Download control found for this attachment. Hover the attachment and click Gmail's download icon, or configure Gmail API."};
  }
  const button=matches[0];
  try{
    button.click();
    // Clicked does not mean saved. The extension checks Chrome Downloads separately.
    return {ok:true,triggered:true,control:button.getAttribute?.("aria-label")||button.getAttribute?.("data-tooltip")||"Gmail download control"};
  }catch(error){
    return {ok:false,error:"Gmail rejected the download control: "+error.message};
  }
}
export function diagnoseVisibleGmailAttachments(){
  const count=selector=>document.querySelectorAll(selector).length;
  return {cards:count(".aZo"),downloadDescriptors:count("[download_url]"),
    namedNodes:count("[data-attachment-id],[data-attachment-name]"),filenameLabels:count(".aV3,.aQy")};
}


export async function downloadAllVisibleGmailAttachments(expectedNames=[]) {
  const wanted=new Set((expectedNames||[]).map(v=>String(v||"").trim()).filter(Boolean));
  const visible=scanVisibleGmailAttachments();
  if(!visible.length)return {ok:false,error:"No visible Gmail attachments found."};
  if(wanted.size&&visible.some(item=>!wanted.has(item.name))){
    return {ok:false,error:"Gmail native ZIP can only be used when all visible attachments are included."};
  }

  const textOf=el=>[
    el.getAttribute?.("aria-label"),
    el.getAttribute?.("data-tooltip"),
    el.getAttribute?.("title"),
    el.getAttribute?.("data-original-title")
  ].filter(Boolean).join(" ").toLowerCase();
  const downloadAllRe=/(download all|download all attachments|изтегли всички|свали всички|скачать все|herunterladen.*alle|télécharger.*tout|descargar.*todo)/i;

  const scopes=[
    document.querySelector(".nH.if"),
    document.querySelector(".adn.ads"),
    document.querySelector(".aHU"),
    document.body
  ].filter(Boolean);
  let button=null;
  for(const scope of scopes){
    const candidates=[...scope.querySelectorAll("button,[role='button'],[aria-label],[data-tooltip],a[href]")];
    button=candidates.find(el=>!el.disabled&&el.getAttribute?.("aria-disabled")!=="true"&&downloadAllRe.test(textOf(el)))||null;
    if(button)break;
  }
  if(!button)return {ok:false,error:"Gmail's Download all attachments button was not found. Hover the attachment area and try again."};

  try{
    button.click();
    return {ok:true,triggered:true};
  }catch(error){
    return {ok:false,error:"Gmail rejected Download all: "+error.message};
  }
}
