import test from "node:test";
import assert from "node:assert/strict";
import {downloadPlan} from "../src/lib/download-plan.js";

test("download plan uses one ZIP for every multi-selection",()=>{
 for(const source of ["page","gmail","gmail-visible"]){
  assert.deepEqual(downloadPlan([{id:1},{id:2}],source),{mode:"zip",count:2});
 }
});
test("download plan keeps single-file source-specific routes",()=>{
 assert.equal(downloadPlan([{id:1}],"page").mode,"page-single");
 assert.equal(downloadPlan([{id:1}],"gmail").mode,"gmail-api-single");
 assert.equal(downloadPlan([{id:1}],"gmail-visible").mode,"gmail-visible-single");
 assert.equal(downloadPlan([],"page").mode,"none");
});
