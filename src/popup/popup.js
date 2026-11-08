import {makeZip} from "../lib/zip.js";
import {classifyFile,filenameFromUrl,uniqueFiles,collectFromPage,isUsefulFile,isMeaningfulImage} from "../lib/files.js";
import {signUp,signIn,signOut,session,entitlement,billingFunction} from "../services/auth.js";
const $=id=>document.getElementById(id);
const state={files:[],selected:new Set(),access:false,gmail:false};
function notice(text){$("status").textContent=text;}
function filtered(){const search=$("search").value.toLowerCase().trim(),type=$("type").value;return state.files.filter(f=>(type==="all"||(type==="relevant"&&isUsefulFile(f))||(type==="image"&&isMeaningfulImage(f))||(type==="attachment"&&f.kind==="attachment")||(type===f.kind))&&(!search||f.name.toLowerCase().includes(search)||f.url.toLowerCase().includes(search)));}
function updateCount(){$("selected").textContent=state.selected.size+" selected";$("download").disabled=!state.selected.size||!state.access;$("download-zip").disabled=!state.selected.size||!state.access;}
function render(){
 const shown=filtered(),container=$("results");container.replaceChildren();
 if(!shown.length){const el=document.createElement("div");el.className="empty";el.textContent=state.gmail?"Gmail attachments need dedicated Google authorization. Page icons are not email attachments.":state.files.length?"No matching files. Try All page assets.":"No downloadable files or substantial photos found.";container.append(el);}
 for(const f of shown){
 const label=document.createElement("label");label.className="file";label.title=f.url;
 const check=document.createElement("input");check.type="checkbox";check.checked=state.selected.has(f.url);check.addEventListener("change",()=>{check.checked?state.selected.add(f.url):state.selected.delete(f.url);updateCount();});
 const symbol=document.createElement("span");symbol.className="file-icon";symbol.textContent=f.kind==="image"?"▧":f.kind==="pdf"?"▤":f.kind==="attachment"?"📎":"↓";
 const meta=document.createElement("span");meta.className="file-meta";
 const name=document.createElement("div");name.className="file-name";name.textContent=f.name;
 const sub=document.createElement("div");sub.className="file-sub";sub.textContent=new URL(f.url).hostname+" · "+f.kind.toUpperCase();
 meta.append(name,sub);label.append(check,symbol,meta);container.append(label);
 }
 $("count").textContent=shown.length+" shown · "+state.files.length+" total assets";$("select-all").disabled=!shown.length;updateCount();
}
async function refreshAccount(){
 $("account-status").textContent="Checking subscription…";$("auth-form").hidden=true;$("billing-actions").hidden=true;
 try{
 const s=await session();
 if(!s){state.access=false;$("account-status").textContent="Sign in to start a 3-day trial through Stripe Checkout.";$("auth-form").hidden=false;updateCount();return;}
 const e=await entitlement();
 state.access=Boolean(e?.access_granted);
 const exp=e?.trial_ends_at?new Date(e.trial_ends_at):null;
 const stillTrial=exp&&exp.getTime()>Date.now();
 const days=stillTrial?Math.ceil((exp.getTime()-Date.now())/3600000):0;
 $("account-status").textContent=state.access?(stillTrial?"Trial active · "+days+" hours left":"Pro subscription active"):(e?.subscription_status?"Subscription inactive · resubscribe to continue":"Start your 3-day free trial · card required");
 $("billing-actions").hidden=false;$("upgrade").hidden=Boolean(e?.subscription_status==="active"||e?.subscription_status==="trialing");
 $("manage").hidden=!e?.subscription_status;
 }catch(e){state.access=false;$("account-status").textContent="Cannot verify access. Check your connection.";}
 updateCount();
}
$("auth-form").addEventListener("submit",async ev=>{
 ev.preventDefault();const btn=$("login");btn.disabled=true;
 try{await signIn($("email").value.trim(),$("password").value);notice("Signed in.");await refreshAccount();}
 catch(e){notice("Sign-in failed: "+e.message);}finally{btn.disabled=false;}
});
$("register").addEventListener("click",async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||password.length<6){notice("Enter an email and a password of at least 6 characters.");return;}
 $("register").disabled=true;
 try{await signUp(email,password);notice("Account created. Check your inbox to confirm your email, then sign in.");}
 catch(e){notice("Registration failed: "+e.message);}finally{$("register").disabled=false;}
});
$("logout").addEventListener("click",async()=>{await signOut();state.selected.clear();await refreshAccount();render();});
for(const [id,fn] of [["upgrade","create-checkout"],["manage","billing-portal"]]){
 $(id).addEventListener("click",async()=>{try{const url=await billingFunction(fn);await chrome.tabs.create({url});}catch(e){notice(e.message);}});
}
$("scan").addEventListener("click",async()=>{
 $("scan").disabled=true;notice("Scanning current tab…");
 try{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw Error("No active tab");
 const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:collectFromPage});
 state.gmail=tab.url?.startsWith("https://mail.google.com/")||false;
 state.files=uniqueFiles(result||[]).map(f=>({...f,kind:classifyFile(f.url,f.kind),name:f.name||filenameFromUrl(f.url)}));state.selected.clear();
 $("search").disabled=false;$("type").disabled=false;notice(state.gmail?"Gmail attachments require Google authorization. Page icons are not email attachments.":state.files.length+" page resources found. Relevant files shown first.");render();
 }catch{notice("Cannot scan this page. Try a regular website (not a browser or store page).");}
 finally{$("scan").disabled=false;}
});
$("search").addEventListener("input",render);$("type").addEventListener("change",render);
$("select-all").addEventListener("click",()=>{const shown=filtered(),all=shown.every(f=>state.selected.has(f.url));for(const f of shown)all?state.selected.delete(f.url):state.selected.add(f.url);render();});
$("download").addEventListener("click",async()=>{
 const items=state.files.filter(f=>state.selected.has(f.url)).map(f=>({url:f.url,filename:f.name}));
 if(!items.length)return;$("download").disabled=true;notice("Verifying subscription and starting downloads…");
 try{const response=await chrome.runtime.sendMessage({type:"BATCH_DOWNLOAD",items});if(!response?.ok)throw Error(response?.error||"Unknown error");notice("Started "+response.started+" downloads"+(response.failed?" · "+response.failed+" failed":"")+".");}
 catch(e){notice("Download failed: "+e.message);await refreshAccount();}finally{updateCount();}
});
refreshAccount();

$("download-zip").addEventListener("click",async()=>{
 if(!state.access){notice("Start your trial or subscribe to download.");return;}
 const chosen=state.files.filter(f=>state.selected.has(f.url));
 if(chosen.length>150){notice("ZIP supports at most 150 selected files.");return;}
 // Chrome requires this permission prompt within a direct user gesture.
 const origins=[...new Set(chosen.map(f=>new URL(f.url).origin+"/*"))];
 let granted=false;
 try{granted=await chrome.permissions.request({origins});}
 catch(e){notice("Site permission request failed: "+e.message);return;}
 if(!granted){notice("Site access is required for ZIP downloads.");return;}
 const button=$("download-zip");button.disabled=true;notice("Building ZIP in your browser…");
 try{
   const access=await entitlement();
   if(!access?.access_granted)throw Error("Trial ended or no active subscription.");
   const entries=[];let total=0;
   for(let i=0;i<chosen.length;i++){
     const f=chosen[i];notice(`Fetching ${i+1}/${chosen.length}: ${f.name}`);
     const response=await fetch(f.url,{credentials:"include",redirect:"follow"});
     if(!response.ok)throw Error(`HTTP ${response.status} for ${f.name}`);
     const size=Number(response.headers.get("content-length")||0);
     if(size&&total+size>100*1024*1024)throw Error("100 MB ZIP limit reached.");
     const data=new Uint8Array(await response.arrayBuffer());
     total+=data.byteLength;
     if(total>100*1024*1024)throw Error("100 MB ZIP limit reached.");
     entries.push({name:f.name,bytes:data});
   }
   const blob=makeZip(entries);
   const url=URL.createObjectURL(blob);
   try{
     await chrome.downloads.download({url,filename:"BatchSave/batchsave-"+new Date().toISOString().slice(0,10)+".zip",saveAs:true,conflictAction:"uniquify"});
     notice(`ZIP download started with ${entries.length} files.`);
   }finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
 }catch(e){notice("ZIP failed: "+e.message+" Try downloading files individually.");}
 finally{button.disabled=false;updateCount();}
});
