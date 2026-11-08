import test from "node:test";
import assert from "node:assert/strict";
import {classifyFile,filenameFromUrl,isValidUrl,uniqueFiles,collectFromPage} from "../src/lib/files.js";

test("classifies images, PDFs and other formats",()=>{
 assert.equal(classifyFile("https://a.com/file.pdf"),"pdf");
 assert.equal(classifyFile("https://a.com/pic.PNG?x=1"),"image");
 assert.equal(classifyFile("https://a.com/a.zip"),"other");
});
test("rejects unsafe URL schemes",()=>{
 assert.equal(isValidUrl("javascript:alert(1)"),false);
 assert.equal(isValidUrl("data:text/html,hi"),false);
 assert.equal(isValidUrl("https://example.org/a"),true);
});
test("normalizes downloaded names",()=>{
 assert.equal(filenameFromUrl("https://a.com/My%20File.pdf"),"My File.pdf");
 assert.equal(filenameFromUrl("https://a.com/a%3Ab.pdf"),"a_b.pdf");
 assert.equal(filenameFromUrl("https://a.com/%2E%2E"),"download");
});
test("removes duplicate URLs",()=>{
 assert.equal(uniqueFiles([{url:"https://a.com/a"},{url:"https://a.com/a"},{url:"ftp://a.com/x"}]).length,1);
});
test("injected scanner detects img, lazy images, direct links and CSS backgrounds",()=>{
 const old=globalThis.document;
 globalThis.document={
  baseURI:"https://example.com/articles/",
  images:[
    {currentSrc:"https://example.com/picture.webp",src:"",naturalWidth:1200,naturalHeight:800},
    {currentSrc:"",src:"",naturalWidth:0,naturalHeight:0,getAttribute:k=>k==="data-src"?"../lazy.png":null}
  ],
  querySelectorAll:(selector)=>{
   if(selector==="a[href]")return [
     {getAttribute:k=>k==="href"?"./reports/statement.pdf":null},
     {getAttribute:k=>k==="href"?"https://example.com/download/not-a-file":null},
     {getAttribute:k=>k==="href"?"javascript:alert(1)":null}
   ];
   return [{getAttribute:()=> "background-image: url('../bg.jpg')"}];
  }
 };
 try{
  const injected=new Function("return ("+collectFromPage.toString()+")()")();
  assert.deepEqual(injected.map(x=>x.url).sort(),[
   "https://example.com/articles/reports/statement.pdf",
   "https://example.com/picture.webp",
   "https://example.com/lazy.png",
   "https://example.com/bg.jpg"
  ].sort());
  assert.equal(injected.find(x=>x.url.endsWith("picture.webp")).width,1200);
 }finally{globalThis.document=old;}
});
