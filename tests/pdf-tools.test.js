import test from "node:test";
import assert from "node:assert/strict";
import {PDFDocument} from "pdf-lib";
import {formatBytes,moveItem,mergePdfFiles,optimizePdfFile} from "../src/lib/pdf-tools-core.js";
import {readFileSync} from "node:fs";

function asFile(name,bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 return {name,size:data.byteLength,async arrayBuffer(){return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);}};
}
async function onePagePdf(width){
 const doc=await PDFDocument.create();doc.addPage([width,400]);return new Uint8Array(await doc.save({useObjectStreams:false}));
}
test("PDF helper preserves explicit file ordering",()=>{
 assert.deepEqual(moveItem(["a","b","c"],2,0),["c","a","b"]);
 assert.deepEqual(moveItem(["a","b"],0,1),["b","a"]);
});
test("merge PDF combines complete documents in selected order",async()=>{
 const first=asFile("first.pdf",await onePagePdf(300));
 const second=asFile("second.pdf",await onePagePdf(500));
 const result=await mergePdfFiles([second,first],{PDFDocument});
 assert.equal(result.pages,2);
 const merged=await PDFDocument.load(result.bytes);
 assert.deepEqual(merged.getPages().map(page=>Math.round(page.getWidth())),[500,300]);
});
test("PDF optimization returns a valid document and never makes the download larger",async()=>{
 const source=await onePagePdf(420),file=asFile("source.pdf",source);
 const result=await optimizePdfFile(file,{PDFDocument});
 assert.ok(result.outputBytes<=result.originalBytes);
 assert.equal((await PDFDocument.load(result.bytes)).getPageCount(),1);
});
test("PDF Tools page exposes all requested workflows and local vendor engine",()=>{
 const html=readFileSync(new URL("../src/pdf-tools/index.html",import.meta.url),"utf8");
 const js=readFileSync(new URL("../src/pdf-tools/pdf-tools.js",import.meta.url),"utf8");
 for(const text of ["Images → PDF","Merge PDF","Compress PDF","Local processing"])assert.ok(html.includes(text),text);
 assert.match(html,/\.\.\/vendor\/pdf-lib\.min\.js/);
 assert.match(js,/imagesToPdf/);
 assert.match(js,/mergePdfFiles/);
 assert.match(js,/optimizePdfFile/);
});
test("human-readable file sizes are stable",()=>{
 assert.equal(formatBytes(500),"500 B");
 assert.equal(formatBytes(2048),"2.0 KB");
});

test("popup PDF controller uses the same tested PDF core",()=>{
 const js=readFileSync(new URL("../src/popup/pdf-tools-panel.js",import.meta.url),"utf8");
 assert.match(js,/imagesToPdf/);
 assert.match(js,/mergePdfFiles/);
 assert.match(js,/optimizePdfFile/);
 assert.match(js,/ensureAccess/);
 assert.match(js,/chrome\.downloads\.download/);
});
