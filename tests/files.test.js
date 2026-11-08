import test from "node:test";import assert from "node:assert/strict";import {classifyFile,filenameFromUrl,isValidUrl,uniqueFiles} from "../src/lib/files.js";
test("classifies common media types",()=>{assert.equal(classifyFile("https://a.com/file.pdf"),"pdf");assert.equal(classifyFile("https://a.com/pic.PNG?x=1"),"image");assert.equal(classifyFile("https://a.com/a.zip"),"other");});
test("rejects unsafe URL schemes",()=>{assert.equal(isValidUrl("javascript:alert(1)"),false);assert.equal(isValidUrl("data:text/html,hi"),false);assert.equal(isValidUrl("https://example.org/a"),true);});
test("sanitizes generated names",()=>{assert.equal(filenameFromUrl("https://a.com/My%20File.pdf"),"My File.pdf");assert.equal(filenameFromUrl("https://a.com/a%3Ab.pdf"),"a_b.pdf");});
test("removes duplicate URLs",()=>{assert.equal(uniqueFiles([{url:"https://a.com/a"},{url:"https://a.com/a"},{url:"ftp://a.com/x"}]).length,1);});
