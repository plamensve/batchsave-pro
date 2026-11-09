import {formatBytes,moveItem,imagesToPdf,pdfPageCount,mergePdfFiles,optimizePdfFile,MAX_PDF_BYTES} from "../lib/pdf-tools-core.js";

const $=id=>document.getElementById(id);

export function initPopupPdfTools({ensureAccess}={}){
 const PDFLIB=globalThis.PDFLib;
 const state={images:[],merge:[],compress:null,mergePages:new Map()};

 function status(id,message,kind="info"){
  const el=$(id);
  el.hidden=!message;
  el.className="pdf-status"+(kind==="info"?"":" "+kind);
  el.textContent=message||"";
 }
 function safeName(name){
  return String(name||"file").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/^\.+/,"").slice(0,150)||"file";
 }
 async function downloadBytes(bytes,name){
  const blob=new Blob([bytes],{type:"application/pdf"});
  const url=URL.createObjectURL(blob);
  try{
   await chrome.downloads.download({url,filename:safeName(name),saveAs:true,conflictAction:"uniquify"});
  }finally{
   setTimeout(()=>URL.revokeObjectURL(url),120000);
  }
 }
 function bindDrop(zoneId,inputId,onFiles){
  const zone=$(zoneId),input=$(inputId);
  input.addEventListener("change",()=>{onFiles([...input.files]);input.value="";});
  for(const type of ["dragenter","dragover"])zone.addEventListener(type,event=>{
   event.preventDefault();zone.classList.add("drag");
  });
  for(const type of ["dragleave","drop"])zone.addEventListener(type,event=>{
   event.preventDefault();zone.classList.remove("drag");
  });
  zone.addEventListener("drop",event=>onFiles([...event.dataTransfer.files]));
 }
 function row(file,index,total,onMove,onRemove,detail){
  const el=document.createElement("div");el.className="pdf-file-row";
  const number=document.createElement("span");number.className="pdf-file-index";number.textContent=index+1;
  const copy=document.createElement("div");copy.className="pdf-file-copy";
  const name=document.createElement("strong");name.textContent=file.name;
  const meta=document.createElement("span");meta.textContent=detail||formatBytes(file.size);
  copy.append(name,meta);
  const actions=document.createElement("div");actions.className="pdf-row-actions";
  const up=document.createElement("button");up.type="button";up.textContent="↑";up.title="Move up";up.disabled=index===0;up.onclick=()=>onMove(index,index-1);
  const down=document.createElement("button");down.type="button";down.textContent="↓";down.title="Move down";down.disabled=index===total-1;down.onclick=()=>onMove(index,index+1);
  const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.title="Remove";remove.className="remove";remove.onclick=()=>onRemove(index);
  actions.append(up,down,remove);
  el.append(number,copy,actions);
  return el;
 }
 function renderImages(){
  const target=$("pdf-image-list");target.replaceChildren();
  state.images.forEach((file,index)=>target.append(row(
   file,index,state.images.length,
   (a,b)=>{state.images=moveItem(state.images,a,b);renderImages();},
   i=>{state.images.splice(i,1);renderImages();}
  )));
  $("pdf-images-create").disabled=!state.images.length;
 }
 async function addMerge(files){
  for(const file of files){
   if(!/\.pdf$/i.test(file.name)){status("pdf-merge-status",file.name+" is not a PDF.","error");continue;}
   if(file.size>MAX_PDF_BYTES){status("pdf-merge-status",file.name+" exceeds 100 MB.","error");continue;}
   try{
    state.mergePages.set(file,await pdfPageCount(file,PDFLIB));
    state.merge.push(file);
   }catch(error){
    status("pdf-merge-status",file.name+": "+error.message,"error");
   }
  }
  renderMerge();
 }
 function renderMerge(){
  const target=$("pdf-merge-list");target.replaceChildren();
  state.merge.forEach((file,index)=>target.append(row(
   file,index,state.merge.length,
   (a,b)=>{state.merge=moveItem(state.merge,a,b);renderMerge();},
   i=>{state.mergePages.delete(state.merge[i]);state.merge.splice(i,1);renderMerge();},
   formatBytes(file.size)+" · "+(state.mergePages.get(file)||"?")+" pages"
  )));
  $("pdf-merge-create").disabled=!state.merge.length;
 }
 function renderCompress(){
  const target=$("pdf-compress-file");target.replaceChildren();
  if(!state.compress){$("pdf-compress-create").disabled=true;return;}
  const file=state.compress;
  const el=row(file,0,1,()=>{},()=>{state.compress=null;renderCompress();},formatBytes(file.size));
  el.querySelectorAll(".pdf-row-actions button").forEach((button,i)=>{if(i<2)button.remove();});
  target.append(el);
  $("pdf-compress-create").disabled=false;
 }

 for(const tab of document.querySelectorAll(".pdf-mode"))tab.addEventListener("click",()=>{
  for(const item of document.querySelectorAll(".pdf-mode"))item.classList.toggle("active",item===tab);
  for(const panel of document.querySelectorAll(".pdf-operation-panel"))panel.hidden=panel.id!==tab.dataset.pdfPanel;
 });

 bindDrop("pdf-image-drop","pdf-image-input",files=>{
  const valid=files.filter(file=>String(file.type||"").startsWith("image/"));
  state.images.push(...valid);renderImages();
  if(valid.length!==files.length)status("pdf-images-status","Some files were skipped because they are not supported images.","error");
 });
 bindDrop("pdf-merge-drop","pdf-merge-input",files=>addMerge(files));
 bindDrop("pdf-compress-drop","pdf-compress-input",files=>{
  const file=files.find(item=>/\.pdf$/i.test(item.name));
  if(!file){status("pdf-compress-status","Choose a PDF file.","error");return;}
  state.compress=file;renderCompress();status("pdf-compress-status","Ready to optimize "+file.name+".");
 });

 $("pdf-images-create").addEventListener("click",async()=>{
  const button=$("pdf-images-create");button.disabled=true;
  try{
   if(ensureAccess)await ensureAccess();
   status("pdf-images-status","Creating PDF from "+state.images.length+" image(s)…");
   const bytes=await imagesToPdf(state.images,{
    dpi:Number($("pdf-image-dpi").value),
    quality:Number($("pdf-image-quality").value)
   },PDFLIB);
   await downloadBytes(bytes,"BatchSave-images.pdf");
   status("pdf-images-status","Created BatchSave-images.pdf · "+state.images.length+" page(s) · "+formatBytes(bytes.byteLength),"success");
  }catch(error){
   status("pdf-images-status",error.message,"error");
  }finally{
   button.disabled=!state.images.length;
  }
 });

 $("pdf-merge-create").addEventListener("click",async()=>{
  const button=$("pdf-merge-create");button.disabled=true;
  try{
   if(ensureAccess)await ensureAccess();
   status("pdf-merge-status","Merging "+state.merge.length+" PDF document(s)…");
   const result=await mergePdfFiles(state.merge,PDFLIB);
   await downloadBytes(result.bytes,"BatchSave-merged.pdf");
   status("pdf-merge-status","Merged "+result.pages+" page(s) · "+formatBytes(result.bytes.byteLength),"success");
  }catch(error){
   status("pdf-merge-status",error.message,"error");
  }finally{
   button.disabled=!state.merge.length;
  }
 });

 $("pdf-compress-create").addEventListener("click",async()=>{
  const button=$("pdf-compress-create");button.disabled=true;
  try{
   if(ensureAccess)await ensureAccess();
   status("pdf-compress-status","Optimizing "+state.compress.name+"…");
   const result=await optimizePdfFile(state.compress,PDFLIB);
   const base=state.compress.name.replace(/\.pdf$/i,"");
   await downloadBytes(result.bytes,base+"-compressed.pdf");
   const saved=result.savedPercent>0.01?" · saved "+result.savedPercent.toFixed(1)+"%":" · already close to optimal";
   status("pdf-compress-status","Before "+formatBytes(result.originalBytes)+" · after "+formatBytes(result.outputBytes)+saved,"success");
  }catch(error){
   status("pdf-compress-status",error.message,"error");
  }finally{
   button.disabled=!state.compress;
  }
 });

 renderImages();renderMerge();renderCompress();
}
