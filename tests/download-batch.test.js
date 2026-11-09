import test from "node:test";
import assert from "node:assert/strict";
import {batchFolder,batchArchiveName,isBatchFolder,safeFileName,baseName,normalizedName,matchesGmailIntent} from "../src/lib/download-batch.js";
import {readFileSync} from "node:fs";

const folder="BatchSave Pro/2026-11-09_08-04-05";
test("selected batch files share the same time-stamped download folder",()=>{
 const d=new Date(2026,10,9,8,4,5);
 assert.equal(batchFolder(d),folder);
 assert.equal(isBatchFolder(folder),true);
 assert.equal(isBatchFolder("../../../private"),false);
 assert.equal(isBatchFolder("BatchSave Pro/../../other"),false);
 assert.equal(batchArchiveName(d),"BatchSave-Pro-2026-11-09_08-04-05.zip");
});
test("file names are sanitized without stripping supported extensions",()=>{
 assert.equal(safeFileName("Invoice:2026.pdf"),"Invoice_2026.pdf");
 assert.equal(safeFileName("../../private.pdf"),"_.._private.pdf");
 assert.equal(safeFileName("CON.txt"),"_CON.txt");
 assert.equal(baseName("C:\\Users\\Downloads\\report.pdf"),"report.pdf");
 assert.equal(normalizedName("%D0%A4%D0%B0%D0%BA%D1%82%D1%83%D1%80%D0%B0.pdf"),"фактура.pdf");
});
test("Gmail routing only matches requested name, known origin, valid expiry and unused intent",()=>{
 const intent={folder,expectedName:"Фактура.pdf",expiresAt:10000,handled:false};
 const item={filename:"C:\\Users\\Downloads\\Фактура.pdf",url:"https://mail.google.com/mail/u/0/",id:42};
 assert.equal(matchesGmailIntent(item,intent,9000),true);
 assert.equal(matchesGmailIntent({...item,url:"https://unrelated.example/file"},intent,9000),false);
 assert.equal(matchesGmailIntent({...item,filename:"secrets.pdf"},intent,9000),false);
 assert.equal(matchesGmailIntent(item,{...intent,handled:true},9000),false);
 assert.equal(matchesGmailIntent(item,intent,11000),false);
 assert.equal(matchesGmailIntent(item,{...intent,folder:"../../unsafe"},9000),false);
});
test("download routing has explicit scope and preserves other download requests",()=>{
 const worker=readFileSync(new URL("../src/background/service-worker.js",import.meta.url),"utf8");
 assert.match(worker,/chrome\.downloads\.onDeterminingFilename\.addListener/);
 assert.match(worker,/matchesGmailIntent\(item,intent\)/);
 assert.match(worker,/if\(!matchesGmailIntent\(item,intent\)\)\{\s*suggest\(\);return;/);
 assert.match(worker,/suggest\(\{filename:intent\.folder/);
 assert.match(worker,/chrome\.storage\.session\.set/);
 assert.match(worker,/CHECK_LICENSE/);
 assert.match(worker,/checkedEntitlement/);
 assert.match(worker,/PREPARE_GMAIL_DOWNLOAD/);
 assert.match(worker,/BATCH_DOWNLOAD/);
 assert.match(worker,/batchFolder\(\)/);
});

test("license checks are centralized and briefly cached to avoid duplicate network gating",()=>{
 const worker=readFileSync(new URL("../src/background/service-worker.js",import.meta.url),"utf8");
 assert.match(worker,/let licenseCache=null/);
 assert.match(worker,/Date\.now\(\)<licenseCache\.expiresAt/);
 assert.match(worker,/expiresAt:Date\.now\(\)\+5000/);
 assert.match(worker,/message\?\.type==="CHECK_LICENSE"/);
});
