import test from "node:test";
import assert from "node:assert/strict";
import {signUp,signOut,session,accountUser} from "../src/services/auth.js";
import {signIn} from "../src/services/auth-login.js";
import {requestPasswordReset,PASSWORD_RECOVERY_REDIRECT} from "../src/services/auth-recovery.js";
import {readFileSync} from "node:fs";

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
test("login trims and normalizes only email while preserving password exactly",async()=>{
 let body;
 await withMock(async(_url,options)=>{
  body=JSON.parse(options.body);
  return new Response(JSON.stringify({access_token:"a",refresh_token:"r",expires_in:3600}),{status:200});
 },async()=>{await signIn("  Test.User@Example.COM  ","  exact Password!  ");});
 assert.deepEqual(body,{email:"test.user@example.com",password:"  exact Password!  "});
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
 assert.equal(target.searchParams.get("redirect_to"),PASSWORD_RECOVERY_REDIRECT);
 assert.deepEqual(JSON.parse(seen.options.body),{email:"test@example.com"});
});

test("password recovery cannot modify or clear an existing login session",async()=>{
 await withMock(async()=>new Response("{}",{status:200}),async storage=>{
  const active={access_token:"keep-me",refresh_token:"keep-refresh",expires_at:Math.floor(Date.now()/1000)+3600};
  storage.set("batchsaveSession",active);
  await requestPasswordReset("test@example.com");
  assert.deepEqual(storage.get("batchsaveSession"),active);
 });
});
test("login and recovery implementations are physically isolated",()=>{
 const login=readFileSync(new URL("../src/services/auth-login.js",import.meta.url),"utf8");
 const recovery=readFileSync(new URL("../src/services/auth-recovery.js",import.meta.url),"utf8");
 const popup=readFileSync(new URL("../src/popup/popup.js",import.meta.url),"utf8");
 assert.match(login,/grant_type=password/);
 assert.ok(!login.includes("/auth/v1/recover"));
 assert.match(recovery,/\/auth\/v1\/recover/);
 assert.ok(!recovery.includes("batchsaveSession"));
 assert.match(popup,/from "\.\.\/services\/auth-login\.js"/);
 assert.match(popup,/from "\.\.\/services\/auth-recovery\.js"/);
});
test("session is removed on signout",async()=>{
 await withMock(async()=>new Response("{}",{status:200}),async store=>{
  store.set("batchsaveSession",{access_token:"abc",expires_at:Math.floor(Date.now()/1000)+3600});
  await signOut();assert.equal(await session(),null);
 });
});

test("expired token refreshes only once during concurrent requests",async()=>{
 let called=0;
 await withMock(async(url)=>{
  assert.match(url,/grant_type=refresh_token/);
  called++;
  await Promise.resolve();
  return new Response(JSON.stringify({access_token:"new-access",refresh_token:"new-refresh",expires_in:3600}),{status:200});
 },async storage=>{
  storage.set("batchsaveSession",{access_token:"expired",refresh_token:"old-refresh",expires_at:1});
  const [first,second,third]=await Promise.all([session(),session(),session()]);
  assert.equal(called,1);
  assert.equal(first.access_token,"new-access");
  assert.equal(second.access_token,"new-access");
  assert.equal(third.access_token,"new-access");
  assert.equal(storage.get("batchsaveSession").refresh_token,"new-refresh");
 });
});
test("temporary auth server failure does not log out user",async()=>{
 await withMock(async()=>new Response(JSON.stringify({error:"server_error",message:"Temporary failure"}),{status:503}),async storage=>{
  storage.set("batchsaveSession",{access_token:"expired",refresh_token:"old-refresh",expires_at:1});
  await assert.rejects(session(),/Temporary failure/);
  assert.equal(storage.get("batchsaveSession").refresh_token,"old-refresh");
 });
});
test("revoked refresh token clears expired session",async()=>{
 await withMock(async()=>new Response(JSON.stringify({error:"invalid_grant",message:"Invalid refresh token"}),{status:400}),async storage=>{
  storage.set("batchsaveSession",{access_token:"expired",refresh_token:"bad-refresh",expires_at:1});
  assert.equal(await session(),null);
  assert.equal(storage.has("batchsaveSession"),false);
 });
});

test("profile is read from Supabase Auth session when present",async()=>{
 await withMock(async()=>{throw Error("Unexpected network call");},async storage=>{
  storage.set("batchsaveSession",{access_token:"good",expires_at:Math.floor(Date.now()/1000)+3600,
    user:{id:"user-1",email:"test@example.com",user_metadata:{full_name:"Test User"}}});
  assert.equal((await accountUser()).email,"test@example.com");
 });
});
test("profile is fetched from Supabase Auth when refresh result has no user",async()=>{
 let urlUsed;
 await withMock(async(url,options)=>{
  urlUsed=url;
  assert.match(options.headers.Authorization,/Bearer good/);
  return new Response(JSON.stringify({id:"user-1",email:"test@example.com"}),{status:200});
 },async storage=>{
  storage.set("batchsaveSession",{access_token:"good",expires_at:Math.floor(Date.now()/1000)+3600});
  assert.equal((await accountUser()).email,"test@example.com");
  assert.equal(storage.get("batchsaveSession").user.email,"test@example.com");
 });
 assert.match(urlUsed,/\/auth\/v1\/user$/);
});

test("login module remains independent from password recovery implementation",()=>{
 const login=readFileSync(new URL("../src/services/auth-login.js",import.meta.url),"utf8");
 const executable=login.replace(/\/\/.*$/gm,"");
 assert.match(executable,/\/auth\/v1\/token\?grant_type=password/);
 assert.ok(!/\/auth\/v1\/recover|account-recovery|auth-recovery\.js/i.test(executable));
});

test("billing errors include missing backend secret names in the surfaced message",()=>{
 const source=readFileSync(new URL("../src/services/auth.js",import.meta.url),"utf8");
 assert.match(source,/payload\.missing/);
 assert.match(source,/Missing:/);
});

test("password recovery normalizes email casing and whitespace",async()=>{
 let body;
 await withMock(async(_url,options)=>{body=JSON.parse(options.body);return new Response("{}",{status:200});},async()=>{
  await requestPasswordReset("  Test.User@Example.COM  ");
 });
 assert.deepEqual(body,{email:"test.user@example.com"});
});

test("account creation sends normalized email and full-name metadata",async()=>{
 let seen;
 await withMock(async(url,options)=>{
  seen={url,body:JSON.parse(options.body)};
  return new Response(JSON.stringify({id:"new-user"}),{status:200,headers:{"content-type":"application/json"}});
 },async()=>{
  await signUp("  New.User@Example.COM  ","StrongPass123!",{fullName:"  New User  "});
 });
 assert.match(seen.url,/\/auth\/v1\/signup\?redirect_to=/);
 assert.deepEqual(seen.body,{
  email:"new.user@example.com",
  password:"StrongPass123!",
  data:{full_name:"New User"}
 });
});
test("account creation validates name and password before network request",async()=>{
 await withMock(async()=>{throw Error("network should not be called");},async()=>{
  await assert.rejects(()=>signUp("user@example.com","short",{fullName:"User"}),/at least 8/);
  await assert.rejects(()=>signUp("user@example.com","StrongPass123!",{fullName:""}),/Full name is required/);
 });
});
