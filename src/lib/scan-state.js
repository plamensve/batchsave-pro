export const SCAN_STATE_KEY="batchsaveLastScanV1";
export const SCAN_STATE_MAX_AGE_MS=12*60*60*1000;

export function makeScanSnapshot({files=[],selected=[],source="page",search="",type="relevant",tabId=null,tabUrl="",savedAt=Date.now()}={}){
 return {
  version:1,
  files:Array.isArray(files)?files.slice(0,500):[],
  selected:Array.isArray(selected)?selected.slice(0,500):[],
  source:["page","gmail","gmail-visible"].includes(source)?source:"page",
  search:String(search||"").slice(0,200),
  type:String(type||"relevant"),
  tabId:Number.isInteger(tabId)?tabId:null,
  tabUrl:String(tabUrl||"").slice(0,4000),
  savedAt:Number(savedAt)||Date.now()
 };
}

export function canRestoreScanSnapshot(snapshot,{tabId=null,tabUrl="",now=Date.now()}={}){
 if(!snapshot||snapshot.version!==1||!Array.isArray(snapshot.files)||!snapshot.files.length)return false;
 if(now-snapshot.savedAt>SCAN_STATE_MAX_AGE_MS||snapshot.savedAt>now+60000)return false;
 if(snapshot.source==="gmail-visible"){
  return Number.isInteger(snapshot.tabId)&&snapshot.tabId===tabId&&
   String(tabUrl||"").startsWith("https://mail.google.com/");
 }
 return true;
}
