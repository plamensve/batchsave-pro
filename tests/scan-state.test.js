import test from "node:test";
import assert from "node:assert/strict";
import {makeScanSnapshot,canRestoreScanSnapshot,SCAN_STATE_MAX_AGE_MS} from "../src/lib/scan-state.js";

test("scan snapshots keep files, filters and selection",()=>{
 const now=Date.now();
 const snap=makeScanSnapshot({files:[{id:"a",name:"a.pdf"}],selected:["a"],source:"page",search:"pdf",type:"pdf",tabId:7,tabUrl:"https://example.com",savedAt:now});
 assert.equal(snap.files.length,1);
 assert.deepEqual(snap.selected,["a"]);
 assert.equal(snap.search,"pdf");
 assert.equal(snap.type,"pdf");
 assert.equal(canRestoreScanSnapshot(snap,{tabId:99,tabUrl:"https://other.example",now}),true);
});

test("Gmail visible snapshots restore only on the original Gmail tab",()=>{
 const now=Date.now();
 const snap=makeScanSnapshot({files:[{id:"g"}],source:"gmail-visible",tabId:12,tabUrl:"https://mail.google.com/mail/u/0/#inbox/x",savedAt:now});
 assert.equal(canRestoreScanSnapshot(snap,{tabId:12,tabUrl:"https://mail.google.com/mail/u/0/#inbox/x",now}),true);
 assert.equal(canRestoreScanSnapshot(snap,{tabId:13,tabUrl:"https://mail.google.com/mail/u/0/#inbox/x",now}),false);
 assert.equal(canRestoreScanSnapshot(snap,{tabId:12,tabUrl:"https://example.com",now}),false);
});

test("expired snapshots are rejected",()=>{
 const now=Date.now();
 const snap=makeScanSnapshot({files:[{id:"a"}],savedAt:now-SCAN_STATE_MAX_AGE_MS-1});
 assert.equal(canRestoreScanSnapshot(snap,{now}),false);
});
