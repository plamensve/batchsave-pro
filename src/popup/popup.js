import {classifyFile,filenameFromUrl,isValidUrl,uniqueFiles,collectFromPage} from "../lib/files.js";
const $=id=>document.getElementById(id);
const state={files:[],selected:new Set()};
function notice(text){$("status").textContent=text;}
function filtered(){const search=$("search").value.toLowerCase().trim();const type=$("type").value;return state.files.filter(f=>(type==="all"||f.kind===type)&&(!search||f.name.toLowerCase().includes(search)||f.url.toLowerCase().includes(search)));}
function render(){
 const shown=filtered();const container=$("results");container.replaceChildren();
 if(!shown.length){const el=document.createElement("div");el.className="empty";el.textContent=state.files.length?"No matching files.":"No downloadable links or images found.";container.append(el);}
 for(const f of shown){
 const label=document.createElement("label");label.className="file";label.title=f.url;
 const check=document.createElement("input");check.type="checkbox";check.checked=state.selected.has(f.url);check.addEventListener("change",()=>{check.checked?state.selected.add(f.url):state.selected.delete(f.url);updateCount();});
 const symbol=document.createElement("span");symbol.className="file-icon";symbol.textContent=f.kind==="image"?"▧":f.kind==="pdf"?"▤":"↓";
 const meta=document.createElement("span");meta.className="file-meta";
 const name=document.createElement("div");name.className="file-name";name.textContent=f.name;
 const sub=document.createElement("div");sub.className="file-sub";sub.textContent=new URL(f.url).hostname+" · "+f.kind.toUpperCase();
 meta.append(name,sub);label.append(check,symbol,meta);container.append(label);
 }
 $("count").textContent=state.files.length+" discovered · "+shown.length+" shown";
 $("select-all").disabled=!shown.length;
 updateCount();
}
function updateCount(){$("selected").textContent=state.selected.size+" selected";$("download").disabled=!state.selected.size;}
$("scan").addEventListener("click",async()=>{
 $("scan").disabled=true;notice("Scanning current tab…");
 try{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw Error("No active tab");
 const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:collectFromPage});
 state.files=uniqueFiles(result||[]).map(f=>({...f,kind:classifyFile(f.url,f.kind),name:filenameFromUrl(f.url)}));state.selected.clear();
 $("search").disabled=false;$("type").disabled=false;notice(state.files.length+" items found. Select files to download.");render();
 }catch(e){notice("Cannot scan this page. Try a regular website (not a browser or store page).");}
 finally{$("scan").disabled=false;}
});
$("search").addEventListener("input",render);$("type").addEventListener("change",render);
$("select-all").addEventListener("click",()=>{const shown=filtered();const all=shown.every(f=>state.selected.has(f.url));for(const f of shown)all?state.selected.delete(f.url):state.selected.add(f.url);render();});
$("download").addEventListener("click",async()=>{
 const items=state.files.filter(f=>state.selected.has(f.url)).map(f=>({url:f.url,filename:f.name}));
 if(!items.length)return;$("download").disabled=true;notice("Sending download requests…");
 try{const response=await chrome.runtime.sendMessage({type:"BATCH_DOWNLOAD",items});if(!response?.ok)throw Error(response?.error||"Unknown error");notice("Started "+response.started+" downloads"+(response.failed?" · "+response.failed+" failed":"")+".");}
 catch(e){notice("Download failed: "+e.message);}finally{updateCount();}
});
