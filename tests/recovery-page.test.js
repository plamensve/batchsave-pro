import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const redirect=readFileSync(new URL("../supabase/functions/account-recovery/index.ts",import.meta.url),"utf8");
const page=readFileSync(new URL("../web/account-recovery.html",import.meta.url),"utf8");

test("Supabase recovery Edge Function redirects to the static recovery page",()=>{
 assert.match(redirect,/status:302/);
 assert.match(redirect,/Location/);
 assert.match(redirect,/plamensve\.github\.io\/DS_ML_DL_PORTFOLIO\/batchsave\/account-recovery\.html/);
 assert.ok(!redirect.includes("<!doctype html>"));
 assert.ok(!redirect.includes("text/html"));
});
test("static recovery page accepts the implicit recovery fragment and updates password",()=>{
 assert.match(page,/location\.hash/);
 assert.match(page,/access_token/);
 assert.match(page,/type&&type!=="recovery"/);
 assert.match(page,/method:"PUT"/);
 assert.match(page,/\/auth\/v1\/user/);
 assert.match(page,/Authorization/);
 assert.match(page,/Password updated successfully/);
});
test("static recovery page validates password confirmation and expired links",()=>{
 assert.match(page,/next!==confirm\.value/);
 assert.match(page,/at least 8 characters/);
 assert.match(page,/expired or was already used/);
});
