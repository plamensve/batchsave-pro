import test from "node:test";
import assert from "node:assert/strict";
import {isMeaningfulImage,isUsefulFile,collectFromPage} from "../src/lib/files.js";
test("excludes tiny tracking pixels and icons by default",()=>{
 assert.equal(isMeaningfulImage({kind:"image",width:1,height:1,source:"page"}),false);
 assert.equal(isMeaningfulImage({kind:"image",width:16,height:16,source:"page"}),false);
 assert.equal(isMeaningfulImage({kind:"image",width:1200,height:800,source:"page"}),true);
 assert.equal(isMeaningfulImage({kind:"image",width:0,height:0,source:"link"}),true);
 assert.equal(isUsefulFile({kind:"attachment"}),true);
});
test("HTML download attribute identifies a real file with opaque URL",()=>{
 const old=globalThis.document;
 globalThis.document={
  baseURI:"https://example.com/mail/",
  images:[{currentSrc:"https://example.com/icon.png",naturalWidth:16,naturalHeight:16}],
  querySelectorAll(s){return s==="a[href]"?[
    {getAttribute:k=>k==="href"?"/export?id=123":k==="download"?"invoice.pdf":null},
    {getAttribute:k=>k==="href"?"/next":null}
  ]:[];}
 };
 try{
  const items=collectFromPage();
  const file=items.find(i=>i.kind==="attachment");
  assert.equal(file.name,"invoice.pdf");
  assert.equal(file.url,"https://example.com/export?id=123");
  assert.equal(items.filter(isUsefulFile).length,1);
 }finally{globalThis.document=old;}
});
