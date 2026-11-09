import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../src/settings/index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../src/settings/settings.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/settings/settings.css",import.meta.url),"utf8");
const manifest=JSON.parse(readFileSync(new URL("../manifest.json",import.meta.url),"utf8"));

test("Settings is registered as the Chrome options page",()=>{
 assert.equal(manifest.options_ui.page,"src/settings/index.html");
 assert.equal(manifest.options_ui.open_in_tab,true);
});
test("Settings stays focused on account and application settings",()=>{
 for(const id of ["account-section","about-section","password-form","new-password","confirm-password","manage-subscription"])
  assert.ok(html.includes('id="'+id+'"'),"missing Settings control "+id);
 assert.ok(!html.includes('id="tools-section"'));
 assert.ok(!html.includes("Open PDF Tools"));
 assert.match(html,/About & privacy/);
 assert.match(html,/Local file processing/);
 assert.match(html,/Gmail access/);
});
test("Settings password change uses authenticated updatePassword flow",()=>{
 assert.match(js,/updatePassword/);
 assert.match(js,/await updatePassword\(password\)/);
 assert.match(js,/Password updated successfully/);
 assert.match(js,/The two passwords do not match/);
});
test("Settings provides subscription portal only for managed Stripe states",()=>{
 assert.match(js,/\["active","trialing"\]\.includes/);
 assert.match(js,/billingFunction\("billing-portal"\)/);
});
test("Settings keeps the BatchSave premium visual system",()=>{
 assert.match(css,/linear-gradient\(118deg,#071b3d/);
 assert.match(css,/border-bottom:3px solid #f2b000/);
});
