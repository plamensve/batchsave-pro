import test from "node:test";
import assert from "node:assert/strict";

test("service worker starts a licensed single-file Chrome download and reports failures",async()=>{
 const previousChrome=globalThis.chrome,previousFetch=globalThis.fetch;
 const listeners={},downloads=[],local=new Map(),sessionStore=new Map();
 local.set("batchsaveSession",{access_token:"valid-access",refresh_token:"refresh",expires_at:Math.floor(Date.now()/1000)+3600,user:{id:"u1",email:"test@example.com"}});
 globalThis.chrome={
  downloads:{
   onDeterminingFilename:{addListener(fn){listeners.filename=fn;}},
   async download(options){downloads.push(options);return downloads.length;}
  },
  storage:{
   local:{
    async get(key){return {[key]:local.get(key)};},
    async set(obj){for(const [k,v] of Object.entries(obj))local.set(k,v);},
    async remove(key){local.delete(key);}
   },
   session:{
    async get(key){return {[key]:sessionStore.get(key)};},
    async set(obj){for(const [k,v] of Object.entries(obj))sessionStore.set(k,v);},
    async remove(key){sessionStore.delete(key);}
   }
  },
  runtime:{
   onMessage:{addListener(fn){listeners.message=fn;}}
  }
 };
 globalThis.fetch=async url=>{
  if(String(url).includes("/rest/v1/rpc/batchsave_entitlement")){
   return new Response(JSON.stringify({access_granted:true,subscription_status:"tester"}),{status:200,headers:{"content-type":"application/json"}});
  }
  throw Error("Unexpected fetch: "+url);
 };
 try{
  await import("../src/background/service-worker.js?download-integration=1");
  assert.equal(typeof listeners.message,"function");
  const send=message=>new Promise(resolve=>{
   const keep=listeners.message(message,{},resolve);
   assert.equal(keep,true);
  });
  const ok=await send({type:"BATCH_DOWNLOAD",items:[{url:"https://example.com/report.pdf",filename:"Report:2026.pdf"}]});
  assert.equal(ok.ok,true);
  assert.equal(ok.started,1);
  assert.equal(ok.failed,0);
  assert.equal(downloads.length,1);
  assert.equal(downloads[0].url,"https://example.com/report.pdf");
  assert.match(downloads[0].filename,/^BatchSave Pro\/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\/Report_2026\.pdf$/);

  const bad=await send({type:"BATCH_DOWNLOAD",items:[{url:"javascript:alert(1)",filename:"bad.txt"}]});
  assert.equal(bad.ok,false);
  assert.equal(bad.started,0);
  assert.equal(bad.failed,1);
  assert.match(bad.error,/Invalid URL/);
  assert.equal(downloads.length,1);
 }finally{
  globalThis.chrome=previousChrome;
  globalThis.fetch=previousFetch;
 }
});
