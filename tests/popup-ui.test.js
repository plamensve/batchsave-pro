import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../src/popup/index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../src/popup/popup.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/popup/popup.css",import.meta.url),"utf8");

test("popup uses unique IDs for every control",()=>{
 const all=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(all.length,new Set(all).size);
});
test("all referenced controls exist in popup markup",()=>{
 const refs=[...new Set([...js.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]))];
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const ref of refs)assert.ok(ids.has(ref),"Missing DOM control #"+ref);
});
test("primary download button is always above the results list",()=>{
 const scan=html.indexOf('id="scan"'),download=html.indexOf('id="download"'),list=html.indexOf('id="results"');
 assert.ok(scan>=0&&download>scan&&list>download);
 assert.equal([...html.matchAll(/\bid="download"/g)].length,1);
 assert.match(css,/\.toolbar #download/);
});
test("no redundant Gmail mailbox-search field appears in main popup",()=>{
 assert.ok(!html.includes('id="gmail-query"'));
 assert.match(js,/query:"has:attachment"/);
});
test("Gmail current-message downloads remain license-gated and select their own card",()=>{
 assert.match(js,/await mustHaveLicense\(\)/);
 assert.match(js,/func:downloadVisibleGmailAttachment/);
 assert.match(js,/args:\[f.position,f.name\]/);
 assert.match(js,/PREPARE_GMAIL_DOWNLOAD/);
 assert.match(js,/if\(source==="gmail-visible"&&state.files.length===1\)/);
});

test("popup shows logged-in account identity and confirms Chrome downloads",()=>{
 for(const id of ["account-details","account-name","account-email","account-license"])
  assert.ok(html.includes('id="'+id+'"'),"missing profile field "+id);
 assert.match(js,/accountUser\(\)/);
 assert.match(js,/chrome\.downloads\.search/);
 assert.match(js,/world:"MAIN"/);
 assert.match(js,/Chrome started/);
 assert.match(js,/GET_GMAIL_FOLDER_STATE/);
});

test("main popup uses the available 600px height and a larger scrolling file list",()=>{
 assert.match(css,/width:490px/);
 assert.match(css,/height:600px/);
 assert.match(css,/\.results\{margin:0 12px 5px;flex:1 1 auto/);
});
test("account identity and plan are clearly labeled",()=>{
 assert.match(js,/Current plan:/);
 assert.match(js,/Signed in/);
});

test("selection actions appear above scanned items, without a duplicate ZIP control",()=>{
 const controls=html.indexOf('class="selection-actions"'),results=html.indexOf('id="results"');
 assert.ok(controls>0&&controls<results);
 for(const id of ["select-all","clear-selection","download-zip","preview-dialog","preview-image","preview-close"])
  assert.equal([...html.matchAll(new RegExp('id="'+id+'"',"g"))].length,1);
});
test("scanned images use thumbnails and a large preview with load-error fallback",()=>{
 assert.match(js,/preview-trigger/);
 assert.match(js,/file-thumb/);
 assert.match(js,/openPreview\(f,trigger\)/);
 assert.match(js,/image\.addEventListener\("error"/);
 assert.match(css,/\.preview-dialog/);
});
test("multiple selected page and Gmail API files are routed to a single ZIP",()=>{
 assert.match(js,/if\(files\.length>1&&state\.source!=="gmail-visible"\)\{/);
 assert.match(js,/await downloadZipFiles\(files\);\s*return;/);
 assert.match(js,/await saveBlob\(makeZip\(entries\),batchFolder\(\)\+"\/files\.zip",false\)/);
 assert.match(js,/chrome\.permissions\.request\(\{origins\}\)/);
});
