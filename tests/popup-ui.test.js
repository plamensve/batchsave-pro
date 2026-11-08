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
 assert.match(js,/downloadVisibleGmailAttachment,args:\[f.position,f.name\]/);
 assert.match(js,/if\(source==="gmail-visible"&&state.files.length===1\)/);
});
