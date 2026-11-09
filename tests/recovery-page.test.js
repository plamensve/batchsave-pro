import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../supabase/functions/account-recovery/index.ts",import.meta.url),"utf8");

test("recovery page accepts the Supabase implicit recovery session and submits password update",()=>{
 assert.match(source,/location\.hash/);
 assert.match(source,/access_token/);
 assert.match(source,/type&&type!=="recovery"/);
 assert.match(source,/method:"PUT"/);
 assert.match(source,/\/auth\/v1\/user/);
 assert.match(source,/Authorization/);
 assert.match(source,/Password updated successfully/);
});
test("recovery page requires matching passwords and reports expired links",()=>{
 assert.match(source,/next!==confirm\.value/);
 assert.match(source,/at least 8 characters/);
 assert.match(source,/expired or was already used/);
});
test("recovery HTML is explicitly served as text\/html with no-store caching",()=>{
 assert.match(source,/Content-Type","text\/html; charset=utf-8"/);
 assert.match(source,/Cache-Control","no-store, max-age=0"/);
});
