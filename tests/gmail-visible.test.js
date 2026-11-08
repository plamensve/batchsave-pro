import test from "node:test";import assert from "node:assert/strict";
import {scanVisibleGmailAttachments,downloadVisibleGmailAttachment} from "../src/services/gmail-visible.js";
function dom(){
 let clicks=0;
 const download={click(){clicks++}};
 const filename={textContent:"invoice_2026.pdf"};
 const card={
   isConnected:true,
   contains:()=>false,
   closest:()=>card,
   getAttribute:()=>null,
   querySelector:selector=>selector.includes(".aV3")?filename:selector.includes("Download")?download:null
 };
 const old=globalThis.document;
 globalThis.document={querySelector:()=>({textContent:"Invoice email"}),querySelectorAll:()=>[card]};
 return {restore:()=>{globalThis.document=old},clicks:()=>clicks};
}
test("visible Gmail attachment detection and native download click",()=>{
 const x=dom();
 try{
   const files=scanVisibleGmailAttachments();
   assert.equal(files.length,1);assert.equal(files[0].name,"invoice_2026.pdf");assert.equal(files[0].position,0);
   const response=downloadVisibleGmailAttachment(0);
   assert.equal(response.ok,true);assert.equal(x.clicks(),1);
 }finally{x.restore();}
});
test("invalid Gmail selection fails safely",()=>{
 const x=dom();try{const r=downloadVisibleGmailAttachment(20);assert.equal(r.ok,false);}finally{x.restore();}
});

test("Gmail percent-encoded filename appears decoded and uses the matching card",()=>{
 const saved=globalThis.document;let clicked=0;
 const download={click(){clicked++;}};
 const card={
  isConnected:true,contains:()=>false,closest(){return this},
  getAttribute:key=>key==="download_url"?"application/pdf:%D0%A4%D0%B0%D0%BA%D1%82%D1%83%D1%80%D0%B0.pdf:attachment-id":null,
  querySelector:selector=>selector.includes("Download")?download:null
 };
 globalThis.document={querySelector:()=>({textContent:"Invoice"}),querySelectorAll:()=>[card]};
 try{
   const files=scanVisibleGmailAttachments();
   assert.equal(files.length,1);
   assert.equal(files[0].name,"Фактура.pdf");
   assert.equal(downloadVisibleGmailAttachment(files[0].position,files[0].name).ok,true);
   assert.equal(clicked,1);
 }finally{globalThis.document=saved;}
});
