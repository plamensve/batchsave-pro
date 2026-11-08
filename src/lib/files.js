const IMAGE_RE=/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|[?#])/i;
export function classifyFile(url,kind){if(kind==="attachment")return "attachment";if(kind==="image"||IMAGE_RE.test(url))return "image";if(/\.pdf(?:$|[?#])/i.test(url))return "pdf";return "other";}
export function isValidUrl(raw){try{const u=new URL(raw);return ["http:","https:"].includes(u.protocol);}catch{return false;}}
export function filenameFromUrl(raw){try{const u=new URL(raw),last=u.pathname.split("/").filter(Boolean).pop()||"download";return (decodeURIComponent(last).replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/^\.+/,"").slice(0,150))||"download";}catch{return "download";}}
export function isMeaningfulImage(file,minWidth=240,minHeight=180){
 if(file.kind!=="image")return false;
 if(file.source==="link")return true;
 return file.width>=minWidth&&file.height>=minHeight;
}
export function isUsefulFile(file){return file.kind!=="image"||isMeaningfulImage(file);}
export function collectFromPage(){
 const fileRe=/\.(pdf|zip|rar|7z|csv|xlsx?|docx?|pptx?|txt|json|xml|mp3|mp4|webm)(?:$|[?#])/i;
 const imageRe=/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|[?#])/i;
 const found=new Map();
 const add=(raw,kind,width=0,height=0,source="page",name="")=>{
   if(!raw||found.size>=3000)return;
   try{
     const url=new URL(raw,document.baseURI);
     if(url.protocol!=="https:"&&url.protocol!=="http:")return;
     url.hash="";const href=url.toString();const old=found.get(href);
     if(!old)found.set(href,{url:href,kind,width:width||0,height:height||0,source,name});
     else if(source==="link"||source==="attachment"){old.kind=kind;old.source=source;if(name)old.name=name;}
     else if(kind==="image"&&width){old.width=Math.max(old.width,width);old.height=Math.max(old.height,height);}
   }catch{}
 };
 for(const img of document.images){
   const raw=img.currentSrc||img.getAttribute?.("data-src")||img.getAttribute?.("data-original")||img.src;
   add(raw,"image",img.naturalWidth,img.naturalHeight,"page");
 }
 for(const a of document.querySelectorAll("a[href]")){
   const value=a.getAttribute("href");if(!value)continue;
   const dl=a.getAttribute("download");
   if(dl!==null){
     add(value,"attachment",0,0,"attachment",dl.trim()||"");
   }else if(fileRe.test(value)||imageRe.test(value)){
     add(value,imageRe.test(value)?"image":"other",0,0,"link");
   }
 }
 for(const el of document.querySelectorAll('[style*="background"]')){
   const style=el.getAttribute("style")||"";
   for(const match of style.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)){
     const w=el.clientWidth||0,h=el.clientHeight||0;
     if(w>=240&&h>=180)add(match[2],"image",w,h,"page");
   }
 }
 return [...found.values()];
}
export function uniqueFiles(files){const seen=new Set();return files.filter(f=>{if(!isValidUrl(f.url)||seen.has(f.url))return false;seen.add(f.url);return true;});}
