import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../src/popup/index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../src/popup/popup.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/popup/popup.css",import.meta.url),"utf8");

test("popup uses unique IDs for every control",()=>{
 const all=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(all.length,new Set(all).size);
});
test("all referenced controls exist in popup markup",()=>{
 const refs=[...new Set([...js.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]))];
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const ref of refs)assert.ok(ids.has(ref),"Missing DOM control #"+ref);
});
test("primary download button is always above the results list",()=>{
 const scan=html.indexOf('id="scan"'),download=html.indexOf('id="download"'),list=html.indexOf('id="results"');
 assert.ok(scan>=0&&download>scan&&list>download);
 assert.equal([...html.matchAll(/\bid="download"/g)].length,1);
 assert.match(css,/\.toolbar #download/);
});
test("no redundant Gmail mailbox-search field appears in main popup",()=>{
 assert.ok(!html.includes('id="gmail-query"'));
 assert.match(js,/query:"has:attachment"/);
});
test("Gmail current-message downloads remain license-gated and select their own card",()=>{
 assert.match(js,/await mustHaveLicense\(\)/);
 assert.match(js,/func:downloadVisibleGmailAttachment/);
 assert.match(js,/args:\[f.position,f.name\]/);
 assert.match(js,/PREPARE_GMAIL_DOWNLOAD/);
 assert.match(js,/if\(source==="gmail-visible"&&state.files.length===1\)/);
});

test("popup shows logged-in account identity and confirms Chrome downloads",()=>{
 for(const id of ["account-details","account-name","account-email","account-license"])
  assert.ok(html.includes('id="'+id+'"'),"missing profile field "+id);
 assert.match(js,/accountUser\(\)/);
 assert.match(js,/chrome\.downloads\.search/);
 assert.match(js,/world:"MAIN"/);
 assert.match(js,/Chrome started/);
 assert.match(js,/GET_GMAIL_FOLDER_STATE/);
});

test("main popup uses the available 600px height and a larger scrolling file list",()=>{
 assert.match(css,/width:620px/);
 assert.match(css,/height:600px/);
 assert.match(css,/\.results\{margin:0 12px 5px;flex:1 1 0;min-height:0/);
});
test("account identity and plan are clearly labeled",()=>{
 assert.match(js,/Current plan:/);
 assert.match(js,/Signed in/);
});

test("selection actions appear above scanned items, without a duplicate ZIP control",()=>{
 const controls=html.indexOf('class="selection-actions"'),results=html.indexOf('id="results"');
 assert.ok(controls>0&&controls<results);
 for(const id of ["select-all","clear-selection","download-zip","preview-dialog","preview-image","preview-frame","preview-details","preview-close"])
  assert.equal([...html.matchAll(new RegExp('id="'+id+'"',"g"))].length,1);
});
test("all scanned files expose preview controls; images and PDFs have rich preview modes",()=>{
 assert.match(js,/preview-trigger/);
 assert.match(js,/file-thumb/);
 assert.match(js,/openPreview\(f,trigger\)/);
 assert.match(js,/isPreviewablePdf/);
 assert.match(js,/\$\("preview-frame"\)/);
 assert.match(js,/\$\("preview-details"\)/);
 assert.match(js,/image\.addEventListener\("error"/);
 assert.match(css,/\.preview-dialog/);
 assert.match(css,/\.preview-details/);
});
test("multiple selected files are routed to a single ZIP through the download plan",()=>{
 assert.match(js,/const plan=downloadPlan\(files,state\.source\)/);
 assert.match(js,/if\(plan\.mode==="zip"\)\{/);
 assert.match(js,/await downloadZipFiles\(files\);\s*return;/);
 assert.match(js,/const archiveName=batchArchiveName\(\)/);
 assert.match(js,/await saveBlob\(makeZip\(entries\),archiveName,false\)/);
 assert.match(js,/chrome\.permissions\.request\(\{origins\}\)/);
});

test("password reset UI cannot leave the stale password in the field",()=>{
 assert.match(html,/id="auth-form" hidden autocomplete="off"/);
 assert.match(html,/id="password"[^>]+autocomplete="off"/);
 assert.match(js,/passwordInput\.value=""/);
 assert.match(js,/Password updated successfully/);
});
test("multi-select primary download exits through ZIP before any individual-download route",()=>{
 const plan=js.indexOf('if(plan.mode==="zip")');
 const zip=js.indexOf("await downloadZipFiles(files);",plan);
 const exit=js.indexOf("return;",zip);
 const batch=js.indexOf('type:"BATCH_DOWNLOAD"',plan);
 assert.ok(plan>=0&&zip>plan&&exit>zip&&batch>exit);
});

test("password field blocks stale autofill and clears invalid credentials",()=>{
 assert.match(html,/id="password"[^>]+readonly/);
 assert.match(js,/function unlockPasswordInput\(\)/);
 assert.match(js,/passwordInput\.value=""/);
 assert.match(js,/Supabase rejected that password/);
});
test("registration messaging does not claim an existing account was newly created",()=>{
 assert.ok(!js.includes("Account created. Confirm your email"));
 assert.match(js,/If this email is new/);
 assert.match(js,/already have an account/);
});

test("download button depends on selection and busy state, not cached license state",()=>{
 assert.match(js,/const count=state\.selected\.size,visible=filtered\(\)\.length,available=!state\.busy/);
 assert.ok(!js.includes("available=!state.busy&&state.access"));
});
test("all multi-file sources are routed through ZIP planning",()=>{
 assert.match(js,/const plan=downloadPlan\(files,state\.source\)/);
 assert.match(js,/if\(plan\.mode==="zip"\)/);
 assert.ok(!js.includes('files.length>1&&state.source!=="gmail-visible"'));
});
test("license validation happens at click time and surfaces sign-in requirements",()=>{
 assert.match(js,/const activeSession=await session\(\)/);
 assert.match(js,/type:"CHECK_LICENSE"/);
 assert.match(js,/Sign in is required before downloading/);
 assert.match(js,/reportDownloadError/);
});

test("tester accounts keep a visible Stripe checkout button without losing tester access",()=>{
 assert.match(js,/const tester=info\?\.subscription_status==="tester"/);
 assert.match(js,/Test Stripe checkout · €9\.90\/month/);
 assert.match(js,/\$\("upgrade"\)\.hidden=!tester/);
});

test("premium popup design keeps core behavior controls and polished visual hooks",()=>{
 for(const id of ["scan","download","upgrade","logout","search","type","results","download-zip"])
  assert.ok(html.includes('id="'+id+'"'),"missing functional control "+id);
 assert.match(html,/brand-divider/);
 assert.match(html,/action-scan/);
 assert.match(html,/action-download/);
 assert.match(css,/--blue:#2463eb/);
 assert.match(css,/radial-gradient/);
 assert.match(css,/\.file-type-badge/);
 assert.match(js,/badge\.className="file-type-badge"/);
 assert.match(js,/box\.dataset\.tone/);
});
test("premium redesign does not remove download, auth, Stripe, Gmail or ZIP event paths",()=>{
 assert.match(js,/billingFunction\("create-checkout"\)/);
 assert.match(js,/billingFunction\("billing-portal"\)/);
 assert.match(js,/downloadPlan\(files,state\.source\)/);
 assert.match(js,/downloadVisibleGmailAttachment/);
 assert.match(js,/downloadZipFiles\(files\)/);
 assert.match(js,/mustHaveLicense\(\)/);
 assert.match(js,/requestPasswordReset\(email\)/);
});

test("v0.9.4 uses real SVG icons and a wider file workspace",()=>{
 assert.match(html,/class="ui-icon"/);
 assert.match(html,/class="status-svg"/);
 assert.match(html,/class="empty-svg"/);
 assert.match(js,/function vectorIcon\(/);
 assert.match(js,/VECTOR_ICONS/);
 assert.match(css,/width:620px/);
 assert.match(css,/\.results\{margin:0 12px 5px;flex:1 1 0;min-height:0/);
 assert.match(css,/html\.full-workspace \.results\{min-height:360px\}/);
 for(const glyph of ["⌗","⇩","↪","📎","▧","▤"])
  assert.ok(!html.includes(glyph)&&!css.includes(glyph)&&!js.includes(glyph),"legacy glyph icon remains: "+glyph);
});

test("last scan is restored from session storage and full workspace can reopen it",()=>{
 assert.match(js,/SCAN_STATE_KEY/);
 assert.match(js,/makeScanSnapshot/);
 assert.match(js,/restoreScanState\(\)/);
 assert.match(js,/chrome\.storage\.session\.set/);
 assert.match(js,/chrome\.windows\.create/);
 assert.match(css,/html\.full-workspace/);
});
test("ZIP button can archive all visible files without manual selection",()=>{
 assert.match(js,/const files=selectedFiles\(\)\.length\?selectedFiles\(\):filtered\(\)/);
 assert.match(js,/ZIP all visible/);
 assert.match(js,/downloadNativeGmailZip/);
 assert.match(js,/downloadAllVisibleGmailAttachments/);
});
test("Stripe checkout shows an animated 3 2 1 launch state",()=>{
 assert.match(js,/for\(const n of \[3,2,1\]\)/);
 assert.match(js,/Opening Stripe · /);
 assert.match(js,/billing-launching/);
 assert.match(css,/@keyframes billingSweep/);
});
test("account and billing actions appear before scan/download actions",()=>{
 const account=html.indexOf('class="auth-panel"');
 const billing=html.indexOf('id="billing-actions"');
 const toolbar=html.indexOf('class="toolbar"');
 assert.ok(account>0&&billing>account&&toolbar>billing);
});
test("premium header uses dark navy treatment with a gold accent",()=>{
 assert.match(css,/linear-gradient\(118deg,#071b3d/);
 assert.match(css,/border-bottom:3px solid #f4b000/);
 assert.match(css,/\.workspace-button/);
 assert.match(css,/color:#eef6ff/);
});

test("password field can be re-unlocked after reset or failed login",()=>{
 assert.match(js,/function lockPasswordInput\(\)/);
 assert.match(js,/if\(!passwordInput\.readOnly\)return/);
 assert.match(js,/passwordInput\.addEventListener\("pointerdown",unlockPasswordInput\)/);
 assert.match(js,/passwordInput\.addEventListener\("focus",unlockPasswordInput\)/);
 assert.ok(!js.includes('{once:true}'));
 assert.match(js,/lockPasswordInput\(\);\n   passwordInput\.focus\(\)/);
 assert.match(js,/lockPasswordInput\(\);\n  authFeedback\("Reset request accepted/);
});
