export const MAX_PDF_BYTES=100*1024*1024;

export function formatBytes(bytes){
 const value=Number(bytes)||0;
 if(value<1024)return value+" B";
 if(value<1024*1024)return (value/1024).toFixed(value<10*1024?1:0)+" KB";
 return (value/(1024*1024)).toFixed(value<10*1024*1024?1:0)+" MB";
}

export function moveItem(items,from,to){
 const list=[...items];
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=list.length||to>=list.length)return list;
 const [item]=list.splice(from,1);list.splice(to,0,item);return list;
}

function pdfLib(lib){
 const resolved=lib||globalThis.PDFLib;
 if(!resolved?.PDFDocument)throw Error("PDF engine is unavailable. Reload the extension.");
 return resolved;
}

function ensureSize(file){
 if(!file)throw Error("Choose a file first.");
 if(file.size>MAX_PDF_BYTES)throw Error(file.name+" exceeds the 100 MB local-processing limit.");
}

function canvasBlob(canvas,type,quality){
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error("Image conversion failed.")),type,quality));
}

async function rasterizeImage(file,quality){
 ensureSize(file);
 if(!String(file.type||"").startsWith("image/"))throw Error(file.name+" is not a supported image.");
 let bitmap;
 try{bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});}
 catch{bitmap=await createImageBitmap(file);}
 const canvas=document.createElement("canvas");
 canvas.width=bitmap.width;canvas.height=bitmap.height;
 const ctx=canvas.getContext("2d",{alpha:false});
 ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);
 bitmap.close?.();
 const blob=await canvasBlob(canvas,"image/jpeg",Math.max(.25,Math.min(.95,quality/100)));
 return {bytes:new Uint8Array(await blob.arrayBuffer()),width:canvas.width,height:canvas.height};
}

export async function imagesToPdf(files,{dpi=150,quality=88}={},lib){
 const {PDFDocument}=pdfLib(lib);
 const selected=[...files];
 if(!selected.length)throw Error("Add at least one image.");
 if(dpi<30||dpi>600)throw Error("DPI must be between 30 and 600.");
 if(quality<25||quality>95)throw Error("Image quality must be between 25 and 95.");
 const doc=await PDFDocument.create();
 for(const file of selected){
  const imageData=await rasterizeImage(file,quality);
  const image=await doc.embedJpg(imageData.bytes);
  const width=imageData.width*72/dpi,height=imageData.height*72/dpi;
  const page=doc.addPage([width,height]);
  page.drawImage(image,{x:0,y:0,width,height});
 }
 return new Uint8Array(await doc.save({useObjectStreams:true,addDefaultPage:false}));
}

export async function pdfPageCount(file,lib){
 ensureSize(file);
 const {PDFDocument}=pdfLib(lib);
 const bytes=new Uint8Array(await file.arrayBuffer());
 const doc=await PDFDocument.load(bytes,{updateMetadata:false});
 return doc.getPageCount();
}

export async function mergePdfFiles(files,lib){
 const selected=[...files];
 if(!selected.length)throw Error("Add at least one PDF.");
 const {PDFDocument}=pdfLib(lib);
 const output=await PDFDocument.create();
 let pages=0;
 for(const file of selected){
  ensureSize(file);
  if(!/\.pdf$/i.test(file.name))throw Error(file.name+" is not a PDF file.");
  const source=await PDFDocument.load(new Uint8Array(await file.arrayBuffer()),{updateMetadata:false});
  const indices=source.getPageIndices();
  const copied=await output.copyPages(source,indices);
  for(const page of copied){output.addPage(page);pages++;}
 }
 if(!pages)throw Error("The selected PDF files contain no pages.");
 return {bytes:new Uint8Array(await output.save({useObjectStreams:true,addDefaultPage:false})),pages};
}

export async function optimizePdfFile(file,lib){
 ensureSize(file);
 if(!/\.pdf$/i.test(file.name))throw Error("Choose a PDF file.");
 const {PDFDocument}=pdfLib(lib);
 const original=new Uint8Array(await file.arrayBuffer());
 const doc=await PDFDocument.load(original,{updateMetadata:false});
 const optimized=new Uint8Array(await doc.save({useObjectStreams:true,addDefaultPage:false,objectsPerTick:20}));
 const bytes=optimized.byteLength<original.byteLength?optimized:original;
 const savedPercent=100*(original.byteLength-bytes.byteLength)/Math.max(1,original.byteLength);
 return {bytes,originalBytes:original.byteLength,outputBytes:bytes.byteLength,savedPercent,pages:doc.getPageCount()};
}
