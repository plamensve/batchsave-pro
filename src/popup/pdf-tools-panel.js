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
 function syncWorkspace(workspaceId,zoneId,count,emptyLabel,filledLabel){
  const workspace=$(workspaceId),zone=$(zoneId);
  workspace.classList.toggle("has-files",count>0);
  const title=zone.querySelector("strong");
  if(title)title.textContent=count>0?filledLabel:emptyLabel;
 }
 function fileCard(file,index,total,onMove,onRemove,detail,{imagePreview=false,label="File",movable=true}={}){
  const el=document.createElement("article");el.className="pdf-file-card";

  const preview=document.createElement("div");preview.className="pdf-card-preview";
  if(imagePreview){
   const img=document.createElement("img");img.className="pdf-card-thumb";img.alt=file.name;
   const url=URL.createObjectURL(file);
   const cleanup=()=>URL.revokeObjectURL(url);
   img.addEventListener("load",cleanup,{once:true});
   img.addEventListener("error",cleanup,{once:true});
   img.src=url;
   preview.append(img);
  }else{
   preview.innerHTML='<svg class="pdf-card-document" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 13h8M8 17h6"/></svg>';
  }

  const position=document.createElement("span");position.className="pdf-card-position";position.textContent=label+" "+(index+1);
  preview.append(position);

  const actions=document.createElement("div");actions.className="pdf-card-actions";
  if(movable){
   const up=document.createElement("button");up.type="button";up.textContent="↑";up.title="Move up";up.disabled=index===0;
   up.onclick=event=>{event.preventDefault();event.stopPropagation();onMove(index,index-1);};
   const down=document.createElement("button");down.type="button";down.textContent="↓";down.title="Move down";down.disabled=index===total-1;
   down.onclick=event=>{event.preventDefault();event.stopPropagation();onMove(index,index+1);};
   actions.append(up,down);
  }
  const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.title="Remove";remove.className="remove";
  remove.onclick=event=>{event.preventDefault();event.stopPropagation();onRemove(index);};
  actions.append(remove);
  preview.append(actions);

  const copy=document.createElement("div");copy.className="pdf-card-copy";
  const name=document.createElement("strong");name.textContent=file.name;name.title=file.name;
  const meta=document.createElement("span");meta.textContent=detail||formatBytes(file.size);
  copy.append(name,meta);

  el.append(preview,copy);
  return el;
 }
 function renderImages(){
  const target=$("pdf-image-list");target.replaceChildren();
  state.images.forEach((file,index)=>target.append(fileCard(
   file,index,state.images.length,
   (a,b)=>{state.images=moveItem(state.images,a,b);renderImages();},
   i=>{state.images.splice(i,1);renderImages();},
   formatBytes(file.size),
   {imagePreview:true,label:"Page"}
  )));
  syncWorkspace("pdf-image-workspace","pdf-image-drop",state.images.length,"Add images","Add more");
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
  state.merge.forEach((file,index)=>target.append(fileCard(
   file,index,state.merge.length,
   (a,b)=>{state.merge=moveItem(state.merge,a,b);renderMerge();},
   i=>{state.mergePages.delete(state.merge[i]);state.merge.splice(i,1);renderMerge();},
   formatBytes(file.size)+" · "+(state.mergePages.get(file)||"?")+" pages",
   {label:"PDF"}
  )));
  syncWorkspace("pdf-merge-workspace","pdf-merge-drop",state.merge.length,"Add PDF documents","Add more");
  $("pdf-merge-create").disabled=!state.merge.length;
 }
 function renderCompress(){
  const target=$("pdf-compress-file");target.replaceChildren();
  if(!state.compress){
   syncWorkspace("pdf-compress-workspace","pdf-compress-drop",0,"Select a PDF","Replace PDF");
   $("pdf-compress-create").disabled=true;
   return;
  }
  const file=state.compress;
  target.append(fileCard(
   file,0,1,()=>{},()=>{state.compress=null;renderCompress();},
   formatBytes(file.size),
   {label:"PDF",movable:false}
  ));
  syncWorkspace("pdf-compress-workspace","pdf-compress-drop",1,"Select a PDF","Replace PDF");
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
