// Download paths are always relative to the user's Chrome Downloads directory.
export function batchFolder(date=new Date()){
 const pad=x=>String(x).padStart(2,"0");
 return "BatchSave Pro/"+[
   date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())
 ].join("-")+"_"+[pad(date.getHours()),pad(date.getMinutes()),pad(date.getSeconds())].join("-");
}
export function isBatchFolder(folder){
 return /^BatchSave Pro\/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(folder||"");
}
export function batchArchiveName(date=new Date()){
 const pad=x=>String(x).padStart(2,"0");
 return "BatchSave-Pro-"+[
  date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())
 ].join("-")+"_"+[pad(date.getHours()),pad(date.getMinutes()),pad(date.getSeconds())].join("-")+".zip";
}
export function safeFileName(name){
 let value=String(name||"download").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_")
  .replace(/^\.+/,"").replace(/[. ]+$/g,"").slice(0,150);
 if(!value)value="download";
 if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value))value="_"+value;
 return value;
}
export function baseName(path){
 return String(path||"").replace(/\\/g,"/").split("/").pop()||"";
}
export function normalizedName(name){
 let result=baseName(name);
 try{result=decodeURIComponent(result);}catch{}
 return result.normalize("NFC").toLocaleLowerCase();
}
export function matchesGmailIntent(item,intent,now=Date.now()){
 if(!intent||!isBatchFolder(intent.folder)||now>intent.expiresAt||intent.handled)return false;
 if(normalizedName(item.filename)!==normalizedName(intent.expectedName))return false;
 const urls=[item.url,item.finalUrl,item.referrer].filter(Boolean);
 return urls.some(raw=>{
  try{
   const host=new URL(raw).hostname.toLowerCase();
   return host==="mail.google.com"||host==="mail-attachment.googleusercontent.com"||
    host.endsWith(".mail.google.com")||host.endsWith(".googleusercontent.com");
  }catch{return false;}
 });
}
