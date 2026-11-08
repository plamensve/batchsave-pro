import test from "node:test";import assert from "node:assert/strict";
import {scanVisibleGmailAttachments,downloadVisibleGmailAttachment} from "../src/services/gmail-visible.js";
function dom(){
 let clicks=0;
 const download={click(){clicks++},getAttribute:key=>key==="aria-label"?"Download":null};
 const filename={textContent:"invoice_2026.pdf"};
 const card={
   isConnected:true,
   contains:()=>false,
   closest:()=>card,
   getAttribute:()=>null,
   querySelector:selector=>selector.includes(".aV3")?filename:null,
   querySelectorAll:()=>[download]
 };
 const old=globalThis.document;
 globalThis.document={querySelector:()=>({textContent:"Invoice email"}),querySelectorAll:()=>[card]};
 return {restore:()=>{globalThis.document=old},clicks:()=>clicks};
}
test("visible Gmail attachment detection and native download click",async()=>{
 const x=dom();
 try{
   const files=scanVisibleGmailAttachments();
   assert.equal(files.length,1);assert.equal(files[0].name,"invoice_2026.pdf");assert.equal(files[0].position,0);
   const response=await downloadVisibleGmailAttachment(0,"invoice_2026.pdf");
   assert.equal(response.ok,true);assert.equal(x.clicks(),1);
 }finally{x.restore();}
});
test("invalid Gmail selection fails safely",async()=>{
 const x=dom();try{const r=await downloadVisibleGmailAttachment(20);assert.equal(r.ok,false);}finally{x.restore();}
});

test("Gmail percent-encoded filename appears decoded and uses the matching card",async()=>{
 const saved=globalThis.document;let clicked=0;
 const download={click(){clicked++;},getAttribute:key=>key==="aria-label"?"Download":null};
 const card={
  isConnected:true,contains:()=>false,closest(){return this},
  getAttribute:key=>key==="download_url"?"application/pdf:%D0%A4%D0%B0%D0%BA%D1%82%D1%83%D1%80%D0%B0.pdf:attachment-id":null,
  querySelector:()=>null,querySelectorAll:()=>[download]
 };
 globalThis.document={querySelector:()=>({textContent:"Invoice"}),querySelectorAll:()=>[card]};
 try{
   const files=scanVisibleGmailAttachments();
   assert.equal(files.length,1);
   assert.equal(files[0].name,"Фактура.pdf");
   assert.equal((await downloadVisibleGmailAttachment(files[0].position,files[0].name)).ok,true);
   assert.equal(clicked,1);
 }finally{globalThis.document=saved;}
});

test("regression: Gmail download_url with multiple colon-delimited metadata segments",async()=>{
 const old=globalThis.document;
 let clicked=0;
 const button={disabled:false,click(){clicked++;},getAttribute:key=>key==="aria-label"?"Download":null};
 const card={
  isConnected:true,closest(){return this;},
  getAttribute:key=>key==="download_url"?
   "application/pdf:%D0%A4%D0%B0%D0%BA%D1%82%D1%83%D1%80%D0%B0.pdf:opaqueId:other:fields":null,
  querySelector:()=>null,querySelectorAll:()=>[button]
 };
 globalThis.document={querySelector:()=>({textContent:"Invoice"}),querySelectorAll:()=>[card]};
 try{
  const files=scanVisibleGmailAttachments();
  assert.equal(files.length,1);
  assert.equal(files[0].name,"Фактура.pdf");
  assert.equal((await downloadVisibleGmailAttachment(files[0].position,"Фактура.pdf")).ok,true);
  assert.equal(clicked,1);
  assert.equal((await downloadVisibleGmailAttachment(files[0].position,"other.pdf")).ok,false);
 }finally{globalThis.document=old;}
});
test("injected functions are self-contained without module variables",()=>{
 assert.doesNotThrow(()=>new Function("return ("+scanVisibleGmailAttachments.toString()+")"));
 assert.doesNotThrow(()=>new Function("return ("+downloadVisibleGmailAttachment.toString()+")"));
});

test("localized Bulgarian Gmail Download button is detected",async()=>{
 const saved=globalThis.document;
 let clicked=0;
 const button={
  disabled:false,
  getAttribute:key=>key==="aria-label"?"Изтегляне":null,
  click(){clicked++;}
 };
 const card={
  isConnected:true,closest(){return this;},
  getAttribute:key=>key==="data-attachment-name"?"report.pdf":null,
  querySelector:()=>null,querySelectorAll:()=>[button]
 };
 globalThis.document={querySelector:()=>({textContent:"Invoice"}),querySelectorAll:()=>[card]};
 try{
   const found=scanVisibleGmailAttachments();
   assert.equal(found.length,1);
   const result=await downloadVisibleGmailAttachment(found[0].position,"report.pdf");
   assert.equal(result.ok,true);
   assert.equal(clicked,1);
 }finally{globalThis.document=saved;}
});
