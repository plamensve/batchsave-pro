import test from "node:test";
import assert from "node:assert/strict";
import {signIn,requestPasswordReset,signOut,session} from "../src/services/auth.js";

async function withMock(mockFetch,fn){
 const prevFetch=globalThis.fetch,prevChrome=globalThis.chrome;
 const storage=new Map();
 globalThis.fetch=mockFetch;
 globalThis.chrome={storage:{local:{
  async get(k){return {[k]:storage.get(k)};},
  async set(o){for(const [k,v] of Object.entries(o))storage.set(k,v);},
  async remove(k){storage.delete(k);}
 }}};
 try{await fn(storage);}finally{globalThis.fetch=prevFetch;globalThis.chrome=prevChrome;}
}
test("login posts password grant, retains valid session",async()=>{
 let seen;
 await withMock(async(url,options)=>{
  seen={url,options};
  return new Response(JSON.stringify({access_token:"testaccess",refresh_token:"refresh",expires_in:3600}),{status:200,headers:{"content-type":"application/json"}});
 },async store=>{
  const auth=await signIn("test@example.com","secret123");
  assert.equal(auth.access_token,"testaccess");
  assert.ok(auth.expires_at>Math.floor(Date.now()/1000));
  assert.equal((await session()).access_token,"testaccess");
  assert.equal(store.get("batchsaveSession").access_token,"testaccess");
 });
 assert.match(seen.url,/\/auth\/v1\/token\?grant_type=password$/);
 assert.deepEqual(JSON.parse(seen.options.body),{email:"test@example.com",password:"secret123"});
});
test("invalid credentials surface API error without storing fake session",async()=>{
 await withMock(async()=>new Response(JSON.stringify({error:"invalid_grant",error_description:"Invalid login credentials"}),{status:400}),async store=>{
  await assert.rejects(()=>signIn("wrong@example.com","incorrect"),/Invalid login credentials/);
  assert.equal(store.has("batchsaveSession"),false);
 });
});
test("password recovery submits a valid email-only request",async()=>{
 let seen;
 await withMock(async(url,options)=>{seen={url,options};return new Response("{}",{status:200});},async()=>{await requestPasswordReset("test@example.com");});
 assert.match(seen.url,/\/auth\/v1\/recover\?redirect_to=/);
 const target=new URL(seen.url);
 assert.equal(target.searchParams.get("redirect_to"),"https://gcfyaaqqsqrjwujpymjz.supabase.co/functions/v1/account-recovery");
 assert.deepEqual(JSON.parse(seen.options.body),{email:"test@example.com"});
});
test("session is removed on signout",async()=>{
 await withMock(async()=>new Response("{}",{status:200}),async store=>{
  store.set("batchsaveSession",{access_token:"abc",expires_at:Math.floor(Date.now()/1000)+3600});
  await signOut();assert.equal(await session(),null);
 });
});
