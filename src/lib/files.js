const IMAGE_RE=/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|[?#])/i;
export function classifyFile(url,kind){if(kind==="image"||IMAGE_RE.test(url))return "image";if(/\.pdf(?:$|[?#])/i.test(url))return "pdf";return "other";}
export function isValidUrl(raw){try{const u=new URL(raw);return ["http:","https:"].includes(u.protocol);}catch{return false;}}
export function filenameFromUrl(raw){try{const u=new URL(raw);const last=u.pathname.split("/").filter(Boolean).pop()||"download";return decodeURIComponent(last).replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").slice(0,150)||"download";}catch{return "download";}}
export function collectFromPage(){
 const fileRe=/\.(pdf|zip|rar|7z|csv|xlsx?|docx?|pptx?|txt|json|xml|mp3|mp4|webm)(?:$|[?#])/i;
 const imageRe=/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|[?#])/i;
 const found=new Map();
 const add=(raw,kind)=>{try{const u=new URL(raw,document.baseURI);if(!["https:","http:"].includes(u.protocol))return;u.hash="";const href=u.toString();if(!found.has(href))found.set(href,{url:href,kind});}catch{}};
 for(const img of document.images){if(img.currentSrc||img.src)add(img.currentSrc||img.src,"image");}
 for(const a of document.querySelectorAll("a[href]")){const value=a.getAttribute("href");if(value&&(fileRe.test(value)||imageRe.test(value)))add(value,"link");}
 return [...found.values()].slice(0,3000);
}
export function uniqueFiles(files){const seen=new Set();return files.filter(f=>{if(!isValidUrl(f.url)||seen.has(f.url))return false;seen.add(f.url);return true;});}
