import test from "node:test";
import assert from "node:assert/strict";
import {crc32,makeZip} from "../src/lib/zip.js";

test("standard CRC32 test vector",()=>{
 assert.equal(crc32(new TextEncoder().encode("123456789")),0xcbf43926);
});

test("ZIP archive has valid local, central and end records",async()=>{
 const blob=makeZip([{name:"hello.txt",bytes:new TextEncoder().encode("Hello!") }],new Date("2026-11-08T12:00:00"));
 const buf=await blob.arrayBuffer(),view=new DataView(buf);
 assert.equal(view.getUint32(0,true),0x04034b50);
 assert.equal(view.getUint32(14,true),crc32(new TextEncoder().encode("Hello!")));
 assert.equal(view.getUint32(buf.byteLength-22,true),0x06054b50);
 assert.equal(view.getUint16(buf.byteLength-22+10,true),1);
 assert.equal(view.getUint32(buf.byteLength-22+12,true),46+"hello.txt".length);
 const cdOffset=view.getUint32(buf.byteLength-22+16,true);
 assert.equal(view.getUint32(cdOffset,true),0x02014b50);
 assert.equal(view.getUint32(cdOffset+42,true),0);
});

test("ZIP filenames cannot create paths outside archive",async()=>{
 const bytes=new TextEncoder().encode("test");
 const blob=makeZip([{name:"../../private.txt",bytes}],new Date("2026-11-08T12:00:00"));
 const archive=new Uint8Array(await blob.arrayBuffer());
 const nameLen=new DataView(archive.buffer).getUint16(26,true);
 const name=new TextDecoder().decode(archive.slice(30,30+nameLen));
 assert.ok(!name.includes("/")&&!name.includes(".."));
});

test("ZIP prevents empty archives and oversized batches",()=>{
 assert.throws(()=>makeZip([]),/Select/);
 const tooMany=Array.from({length:151},(_,i)=>({name:i+".txt",bytes:new Uint8Array(0)}));
 assert.throws(()=>makeZip(tooMany),/150/);
});
