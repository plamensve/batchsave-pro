import test from "node:test";
import assert from "node:assert/strict";
import {extractGmailAttachments,decodeBase64Url} from "../src/services/gmail.js";
test("collects actual attachment parts, not message-body images or Gmail UI icons",()=>{
 const msg={id:"msgABC",payload:{headers:[{name:"Subject",value:"Invoice"},{name:"From",value:"Accounts <a@example.com>"}],parts:[
  {filename:"",mimeType:"text/html",body:{data:"PGgxPkhlbGxvPC9oMT4="}},
  {filename:"invoice.pdf",mimeType:"application/pdf",partId:"1",body:{attachmentId:"ATT123",size:1024}},
  {filename:"photo.png",mimeType:"image/png",partId:"2",body:{data:"aGVsbG8=",size:5}}
 ]}};
 const files=extractGmailAttachments(msg);
 assert.equal(files.length,2);
 assert.equal(files[0].name,"invoice.pdf");
 assert.equal(files[0].attachmentId,"ATT123");
 assert.equal(files[1].name,"photo.png");
 assert.equal(files[1].subject,"Invoice");
});
test("decodes Gmail base64url payloads",()=>{
 assert.deepEqual([...decodeBase64Url("aGVsbG8")],[104,101,108,108,111]);
 assert.throws(()=>decodeBase64Url(undefined),/no data/);
});
