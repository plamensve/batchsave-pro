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
 assert.match(css,/\.results\{margin:0 12px 3px;flex:1 1 0;min-height:0/);
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

test("password reset clears the login password without making the login field readonly",()=>{
 assert.match(html,/id="auth-form" hidden autocomplete="off"/);
 assert.match(html,/id="password"[^>]+autocomplete="current-password"/);
 assert.ok(!/id="password"[^>]+readonly/.test(html));
 assert.match(js,/function clearPasswordInput\(\)/);
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

test("login password field is standard, visible on demand and preserved after invalid credentials",()=>{
 assert.match(html,/id="password"[^>]+autocomplete="current-password"/);
 assert.ok(!html.match(/id="password"[^>]+readonly/));
 assert.ok(html.includes('id="toggle-password"'));
 assert.match(js,/passwordInput\.type=showing\?"password":"text"/);
 assert.match(js,/if\(bad\)passwordInput\.focus\(\)/);
 assert.ok(!js.includes('if(bad){\n   clearPasswordInput()'));
 assert.match(js,/The password was kept in the field/);
});
test("Create account opens a dedicated registration form instead of reusing login fields",()=>{
 for(const id of ["signup-form","signup-name","signup-email","signup-password","signup-confirm","signup-submit","signup-cancel"])
  assert.ok(html.includes('id="'+id+'"'),"missing signup control "+id);
 assert.match(js,/function openSignupForm\(\)/);
 assert.match(js,/\$\("register"\)\.addEventListener\("click",openSignupForm\)/);
 assert.match(js,/\$\("signup-form"\)\.addEventListener\("submit"/);
 assert.match(js,/signUp\(email,password,\{fullName:name\}\)/);
 assert.match(js,/The two passwords do not match/);
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
 assert.match(js,/const tester=subscriptionStatus==="tester"/);
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

test("popup uses real SVG icons and the wider results workspace",()=>{
 assert.match(html,/class="ui-icon"/);
 assert.match(html,/class="status-svg"/);
 assert.match(html,/class="empty-svg"/);
 assert.match(js,/function vectorIcon\(/);
 assert.match(js,/VECTOR_ICONS/);
 assert.match(css,/width:620px/);
 assert.match(css,/\.results\{margin:0 12px 3px;flex:1 1 0;min-height:0/);
 for(const glyph of ["⌗","⇩","↪","📎","▧","▤"])
  assert.ok(!html.includes(glyph)&&!css.includes(glyph)&&!js.includes(glyph),"legacy glyph icon remains: "+glyph);
});

test("last scan is restored from session storage without a separate workspace launcher",()=>{
 assert.match(js,/SCAN_STATE_KEY/);
 assert.match(js,/makeScanSnapshot/);
 assert.match(js,/restoreScanState\(\)/);
 assert.match(js,/chrome\.storage\.session\.set/);
 assert.ok(!html.includes('id="open-workspace"'));
 assert.ok(!js.includes("chrome.windows.create"));
 assert.ok(!css.includes("full-workspace"));
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
 assert.match(css,/\.header-signout/);
 assert.match(css,/color:#ffdbe1/);
});

test("reset clears password but invalid login preserves it for inspection",()=>{
 assert.match(js,/function clearPasswordInput\(\)/);
 assert.ok(!js.includes("readOnly"));
 assert.ok(!js.includes("unlockPasswordInput"));
 assert.match(js,/if\(bad\)passwordInput\.focus\(\)/);
 assert.match(js,/clearPasswordInput\(\);\n  authFeedback\("Reset request accepted/);
});

test("sign out lives only in the header while billing CTA remains in the account card",()=>{
 assert.match(html,/id="logout" class="header-signout"/);
 assert.equal([...html.matchAll(/id="logout"/g)].length,1);
 assert.ok(!html.includes("session-action"));
 assert.match(html,/class="primary subscription-action"/);
 assert.match(html,/class="upgrade-label"/);
 assert.match(css,/\.header-signout/);
 assert.match(js,/\$\("logout"\)\.hidden=true/);
 assert.match(js,/\$\("logout"\)\.hidden=false/);
});

test("inline scan feedback field is removed to expand results workspace",()=>{
 assert.ok(!html.includes('id="scan-feedback"'));
 assert.ok(!css.includes(".scan-feedback{"));
 assert.ok(!js.includes('$("scan-feedback")'));
});
test("Clear results deletes current results and persisted scan session",()=>{
 assert.ok(html.includes('id="clear-results"'));
 assert.match(js,/\$\("clear-results"\)\.addEventListener\("click",async\(\)=>/);
 assert.match(js,/state\.files=\[\]/);
 assert.match(js,/state\.selected\.clear\(\)/);
 assert.match(js,/chrome\.storage\.session\.remove\(SCAN_STATE_KEY\)/);
 assert.match(js,/Scanned results cleared/);
});
test("results workspace receives the reclaimed vertical area",()=>{
 assert.match(css,/\.results\{margin:0 12px 3px;flex:1 1 0/);
 assert.match(css,/\.selection-actions\{display:flex;align-items:center;gap:7px;padding:0 12px 5px/);
});

test("Workspace control is removed and replaced by a header logout icon",()=>{
 assert.ok(!html.includes("Workspace"));
 assert.ok(!html.includes('id="open-workspace"'));
 assert.match(html,/id="logout" class="header-signout"/);
 assert.match(html,/aria-label="Sign out"/);
});

test("paid and trial accounts use explicit BatchSave Pro plan labels",()=>{
 assert.match(js,/subscriptionStatus==="active"\?"BatchSave Pro · Active"/);
 assert.match(js,/subscriptionStatus==="trialing"\?"BatchSave Pro · Trial"/);
 assert.match(js,/Signed in · BatchSave Pro active/);
});
test("active or trial subscriptions expose Manage subscription instead of checkout",()=>{
 assert.match(html,/id="manage" class="secondary manage-subscription"/);
 assert.match(html,/Manage subscription/);
 assert.match(js,/const managedSubscription=\["active","trialing"\]\.includes\(subscriptionStatus\)/);
 assert.match(js,/\$\("upgrade"\)\.hidden=!tester&&managedSubscription/);
 assert.match(js,/\$\("manage"\)\.hidden=!managedSubscription/);
 assert.match(css,/\.billing-actions \.manage-subscription/);
});

test("signed-out popup exposes auth only and keeps downloader workspace hidden",()=>{
 assert.match(html,/id="main-workspace" class="main-workspace" hidden/);
 assert.match(js,/\$\("main-workspace"\)\.hidden=true/);
 assert.match(js,/root\.classList\.add\("signed-out"\)/);
 assert.match(js,/\$\("auth-form"\)\.hidden=false/);
 assert.match(css,/html\.signed-out/);
});
test("signed-in identity and plan live inside the premium header",()=>{
 const header=html.slice(html.indexOf('<header class="header">'),html.indexOf("</header>")+9);
 for(const id of ["header-account","account-avatar","account-name","account-email","account-status","account-license","settings","logout"])
  assert.ok(header.includes('id="'+id+'"'),"missing header account control "+id);
 assert.match(js,/\$\("header-account"\)\.hidden=false/);
 assert.match(js,/\$\("settings"\)\.hidden=false/);
});
test("Settings button opens the registered Chrome options page",()=>{
 assert.match(js,/\$\("settings"\)\.addEventListener\("click",\(\)=>chrome\.runtime\.openOptionsPage\(\)\)/);
 assert.match(css,/\.header-settings/);
});

test("signed-out login view is taller than the original but uses the space purposefully",()=>{
 assert.match(css,/html\.signed-out,html\.signed-out body\{\n height:318px;/);
 assert.match(css,/html\.signed-out \.auth-panel\{\n margin:12px 16px 0;/);
 assert.match(css,/html\.signed-out \.auth-panel input\{\n height:40px;/);
 assert.match(html,/class="auth-hint"/);
 assert.match(css,/\.auth-hint\{/);
});

test("signed-out login offers password visibility without adding another auth action",()=>{
 assert.match(html,/id="toggle-password"/);
 assert.match(html,/aria-label="Show password"/);
 assert.match(css,/\.password-toggle/);
 assert.match(js,/Hide password/);
});
