const IMAGE_RE=/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|[?#])/i;
export function classifyFile(url,kind){if(kind==="image"||IMAGE_RE.test(url))return "image";if(/\.pdf(?:$|[?#])/i.test(url))return "pdf";return "other";}
export function isValidUrl(raw){try{const u=new URL(raw);return ["http:","https:"].includes(u.protocol);}catch{return false;}}
export function filenameFromUrl(raw){try{
 const u=new URL(raw),last=u.pathname.split("/").filter(Boolean).pop()||"download";
 return (decodeURIComponent(last).replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/^\.+/,"").slice(0,150))||"download";
}catch{return "download";}}
export function collectFromPage(){
 // This function runs as a self-contained injected script in the page.
 const fileRe=/\.(pdf|zip|rar|7z|csv|xlsx?|docx?|pptx?|txt|json|xml|mp3|mp4|webm)(?:$|[?#])/i;
 const imageRe=/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|[?#])/i;
 const found=new Map();
 const add=(raw,kind,width=0,height=0)=>{
   if(!raw||found.size>=3000)return;
   try{
     const url=new URL(raw,document.baseURI);
     if(url.protocol!=="https:"&&url.protocol!=="http:")return;
     url.hash="";const href=url.toString();
     if(!found.has(href))found.set(href,{url:href,kind,width:width||0,height:height||0});
     else if(kind==="image"&&width){const old=found.get(href);old.kind="image";old.width=width;old.height=height;}
   }catch{}
 };
 for(const img of document.images){
   add(img.currentSrc||img.getAttribute("data-src")||img.getAttribute("data-original")||img.src,"image",img.naturalWidth,img.naturalHeight);
 }
 for(const a of document.querySelectorAll("a[href]")){
   const value=a.getAttribute("href");
   if(value&&(fileRe.test(value)||imageRe.test(value)))add(value,"link");
 }
 // Detect common CSS background images without scanning every computed style.
 for(const el of document.querySelectorAll('[style*="background"],[style*="background-image"]')){
   if(found.size>=3000)break;
   const style=el.getAttribute("style")||"";
   for(const match of style.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)){
      if(match[2])add(match[2],"image");
   }
 }
 return [...found.values()];
}
export function uniqueFiles(files){const seen=new Set();return files.filter(f=>{if(!isValidUrl(f.url)||seen.has(f.url))return false;seen.add(f.url);return true;});}
