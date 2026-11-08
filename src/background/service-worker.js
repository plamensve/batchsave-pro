// Chrome handles the final download; URLs are never sent to a third-party service.
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
 if(message?.type!=="BATCH_DOWNLOAD")return false;
 (async()=>{
  const items=Array.isArray(message.items)?message.items.slice(0,3000):[];
  if(!items.length)return {ok:false,error:"No files selected"};
  let started=0,failed=0;
  for(const item of items){
   try{
    const u=new URL(item.url);if(!["http:","https:"].includes(u.protocol))throw Error("Invalid URL");
    const filename=String(item.filename||"download").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").slice(0,150)||"download";
    await chrome.downloads.download({url:u.href,filename:"BatchSave/"+filename,conflictAction:"uniquify",saveAs:false});started++;
   }catch{failed++;}
  }
  return {ok:true,started,failed};
 })().then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message}));
 return true;
});
