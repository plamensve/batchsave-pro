import {formatBytes,moveItem,imagesToPdf,pdfPageCount,mergePdfFiles,optimizePdfFile,MAX_PDF_BYTES} from "../lib/pdf-tools-core.js";

const $=id=>document.getElementById(id);
const PDFLIB=globalThis.PDFLib;
$("version").textContent="v"+chrome.runtime.getManifest().version;
const state={images:[],merge:[],compress:null,mergePages:new Map()};

function status(id,message,kind="info"){
 const el=$(id);el.hidden=!message;el.className="status"+(kind==="info"?"":" "+kind);el.textContent=message||"";
}
function safeName(name){return String(name||"file").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/^\.+/,"").slice(0,150)||"file";}
async function downloadBytes(bytes,name){
 const blob=new Blob([bytes],{type:"application/pdf"}),url=URL.createObjectURL(blob);
 try{await chrome.downloads.download({url,filename:safeName(name),saveAs:true,conflictAction:"uniquify"});}
 finally{setTimeout(()=>URL.revokeObjectURL(url),120000);}
}
function bindDrop(zoneId,inputId,onFiles){
 const zone=$(zoneId),input=$(inputId);
 input.addEventListener("change",()=>{onFiles([...input.files]);input.value="";});
 for(const type of ["dragenter","dragover"])zone.addEventListener(type,event=>{event.preventDefault();zone.classList.add("drag");});
 for(const type of ["dragleave","drop"])zone.addEventListener(type,event=>{event.preventDefault();zone.classList.remove("drag");});
 zone.addEventListener("drop",event=>onFiles([...event.dataTransfer.files]));
}
function row(file,index,total,onMove,onRemove,detail){
 const el=document.createElement("div");el.className="file-row";
 const n=document.createElement("span");n.className="file-index";n.textContent=index+1;
 const copy=document.createElement("div");copy.className="file-copy";
 const name=document.createElement("strong");name.textContent=file.name;
 const meta=document.createElement("span");meta.textContent=detail||formatBytes(file.size);
 copy.append(name,meta);
 const actions=document.createElement("div");actions.className="row-actions";
 const up=document.createElement("button");up.type="button";up.textContent="↑";up.title="Move up";up.disabled=index===0;up.onclick=()=>onMove(index,index-1);
 const down=document.createElement("button");down.type="button";down.textContent="↓";down.title="Move down";down.disabled=index===total-1;down.onclick=()=>onMove(index,index+1);
 const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.title="Remove";remove.className="remove";remove.onclick=()=>onRemove(index);
 actions.append(up,down,remove);el.append(n,copy,actions);return el;
}
function renderImages(){
 const target=$("image-list");target.replaceChildren();
 state.images.forEach((file,index)=>target.append(row(file,index,state.images.length,(a,b)=>{state.images=moveItem(state.images,a,b);renderImages();},i=>{state.images.splice(i,1);renderImages();})));
 $("images-create").disabled=!state.images.length;
}
async function addMerge(files){
 for(const file of files){
  if(!/\.pdf$/i.test(file.name)){status("merge-status",file.name+" is not a PDF.","error");continue;}
  if(file.size>MAX_PDF_BYTES){status("merge-status",file.name+" exceeds 100 MB.","error");continue;}
  try{state.mergePages.set(file,await pdfPageCount(file,PDFLIB));state.merge.push(file);}
  catch(error){status("merge-status",file.name+": "+error.message,"error");}
 }
 renderMerge();
}
function renderMerge(){
 const target=$("merge-list");target.replaceChildren();
 state.merge.forEach((file,index)=>target.append(row(file,index,state.merge.length,(a,b)=>{state.merge=moveItem(state.merge,a,b);renderMerge();},i=>{state.mergePages.delete(state.merge[i]);state.merge.splice(i,1);renderMerge();},formatBytes(file.size)+" · "+(state.mergePages.get(file)||"?")+" pages")));
 $("merge-create").disabled=!state.merge.length;
}
function renderCompress(){
 const target=$("compress-file");target.replaceChildren();
 if(!state.compress){$("compress-create").disabled=true;return;}
 const file=state.compress;
 const el=row(file,0,1,()=>{},()=>{state.compress=null;renderCompress();},formatBytes(file.size));
 el.querySelectorAll(".row-actions button").forEach((button,i)=>{if(i<2)button.remove();});
 target.append(el);$("compress-create").disabled=false;
}

for(const tab of document.querySelectorAll(".tab"))tab.addEventListener("click",()=>{
 for(const item of document.querySelectorAll(".tab"))item.classList.toggle("active",item===tab);
 for(const panel of document.querySelectorAll(".panel"))panel.hidden=panel.id!==tab.dataset.panel;
});

bindDrop("image-drop","image-input",files=>{
 const valid=files.filter(file=>String(file.type||"").startsWith("image/"));
 state.images.push(...valid);renderImages();
 if(valid.length!==files.length)status("images-status","Some files were skipped because they are not images.","error");
});
bindDrop("merge-drop","merge-input",files=>addMerge(files));
bindDrop("compress-drop","compress-input",files=>{
 const file=files.find(item=>/\.pdf$/i.test(item.name));
 if(!file){status("compress-status","Choose a PDF file.","error");return;}
 state.compress=file;renderCompress();status("compress-status","Ready to optimize "+file.name+".");
});

$("images-create").addEventListener("click",async()=>{
 const button=$("images-create");button.disabled=true;
 try{
  status("images-status","Creating PDF from "+state.images.length+" image(s)…");
  const bytes=await imagesToPdf(state.images,{dpi:Number($("image-dpi").value),quality:Number($("image-quality").value)},PDFLIB);
  await downloadBytes(bytes,"BatchSave-images.pdf");
  status("images-status","Created BatchSave-images.pdf · "+state.images.length+" page(s) · "+formatBytes(bytes.byteLength),"success");
 }catch(error){status("images-status",error.message,"error");}
 finally{button.disabled=!state.images.length;}
});

$("merge-create").addEventListener("click",async()=>{
 const button=$("merge-create");button.disabled=true;
 try{
  status("merge-status","Merging "+state.merge.length+" PDF document(s)…");
  const result=await mergePdfFiles(state.merge,PDFLIB);
  await downloadBytes(result.bytes,"BatchSave-merged.pdf");
  status("merge-status","Merged "+result.pages+" page(s) into BatchSave-merged.pdf · "+formatBytes(result.bytes.byteLength),"success");
 }catch(error){status("merge-status",error.message,"error");}
 finally{button.disabled=!state.merge.length;}
});

$("compress-create").addEventListener("click",async()=>{
 const button=$("compress-create");button.disabled=true;
 try{
  status("compress-status","Optimizing "+state.compress.name+"…");
  const result=await optimizePdfFile(state.compress,PDFLIB);
  const base=state.compress.name.replace(/\.pdf$/i,"");
  await downloadBytes(result.bytes,base+"-compressed.pdf");
  const saved=result.savedPercent>0.01?" · saved "+result.savedPercent.toFixed(1)+"%":" · already close to optimal";
  status("compress-status","Before "+formatBytes(result.originalBytes)+" · after "+formatBytes(result.outputBytes)+saved,"success");
 }catch(error){status("compress-status",error.message,"error");}
 finally{button.disabled=!state.compress;}
});

renderImages();renderMerge();renderCompress();
