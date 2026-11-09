Deno.serve((req)=>{
 if(req.method!=="GET"){
  return new Response("Method not allowed",{status:405,headers:{"Content-Type":"text/plain; charset=utf-8","Allow":"GET"}});
 }
 const project="https://gcfyaaqqsqrjwujpymjz.supabase.co";
 const key="sb_publishable_S2ErUIpwWy-lmia3pEHwsw_803Cbb9Q";
 const nonce=crypto.randomUUID().replace(/-/g,"");
 const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>BatchSave Pro — reset password</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#17233b;background:#f3f6fc}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 70% 0,#dceaff,transparent 35%),#f3f6fc}
.card{width:min(470px,100%);background:#fff;border:1px solid #dce5f3;border-radius:18px;padding:28px;box-shadow:0 16px 44px #19396b20}
.brand-row{display:flex;align-items:center;gap:11px;margin-bottom:16px}.logo{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;color:#fff;background:linear-gradient(145deg,#1e70ff,#174ee3 55%,#10c6d7);font-size:22px;font-weight:850}
.brand{display:flex;flex-direction:column}.brand strong{font-size:16px}.brand span{font-size:10px;color:#718096}
h1{font-size:23px;margin:0 0 10px}p{font-size:13px;line-height:1.55;color:#52657f;margin:0 0 15px}
.status{padding:11px 12px;border-radius:10px;background:#eef4ff;border:1px solid #d4e2f8;color:#345477}
.status[data-kind="error"]{background:#fff3f3;border-color:#efb4b4;color:#962828}.status[data-kind="success"]{background:#f0fff6;border-color:#a4dac0;color:#17623e}
form{margin-top:14px}label{display:block;font-size:12px;font-weight:700;margin:10px 0 5px;color:#40516b}
input,button{width:100%;font:inherit;border-radius:10px}input{height:44px;border:1px solid #cfdae9;padding:0 11px}input:focus{outline:2px solid #3265e6;outline-offset:1px}
button{margin-top:15px;border:0;padding:12px;background:linear-gradient(135deg,#2d73f2,#174cca);color:#fff;font-weight:800;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}
.help{font-size:11px;color:#718096;margin-top:13px}
</style>
</head>
<body>
<main class="card">
<div class="brand-row"><div class="logo">B</div><div class="brand"><strong>BatchSave Pro</strong><span>Secure password recovery</span></div></div>
<h1>Reset your password</h1>
<p id="status" class="status">Checking the recovery link…</p>
<form id="form" hidden novalidate>
<label for="password">New password</label>
<input id="password" type="password" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" minlength="8" required placeholder="At least 8 characters">
<label for="confirm">Confirm new password</label>
<input id="confirm" type="password" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" minlength="8" required placeholder="Repeat the new password">
<button id="submit" type="submit">Update password</button>
</form>
<p class="help">After a successful update, return to the BatchSave Pro extension and sign in with the new password.</p>
</main>
<script nonce="${nonce}">
(()=>{
 const hash=new URLSearchParams(location.hash.startsWith("#")?location.hash.slice(1):location.hash);
 const query=new URLSearchParams(location.search);
 const token=hash.get("access_token")||query.get("access_token")||"";
 const type=hash.get("type")||query.get("type")||"";
 const linkError=hash.get("error_description")||hash.get("error")||query.get("error_description")||query.get("error")||"";
 const status=document.getElementById("status"),form=document.getElementById("form"),password=document.getElementById("password"),confirm=document.getElementById("confirm"),submit=document.getElementById("submit");
 const setStatus=(message,kind="info")=>{status.textContent=message;status.dataset.kind=kind;};
 if(location.hash||location.search)history.replaceState(null,"",location.pathname);
 if(linkError){setStatus("Recovery link error: "+linkError+". Request a new reset email from BatchSave Pro.","error");return;}
 if(!token){setStatus("This recovery link does not contain a valid recovery session. Request a new reset email and open the newest message.","error");return;}
 if(type&&type!=="recovery"){setStatus("This is not a password-recovery link. Request a new reset email from BatchSave Pro.","error");return;}
 setStatus("Recovery link verified. Choose a new password below.");form.hidden=false;password.focus();
 form.addEventListener("submit",async(event)=>{
  event.preventDefault();
  const next=password.value;
  if(next.length<8){setStatus("Use a password of at least 8 characters.","error");password.focus();return;}
  if(next!==confirm.value){setStatus("The two passwords do not match.","error");confirm.focus();return;}
  submit.disabled=true;submit.textContent="Updating…";setStatus("Updating your password…");
  try{
   const response=await fetch("${project}/auth/v1/user",{
    method:"PUT",
    headers:{"apikey":"${key}","Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({password:next}),cache:"no-store"
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok){
    const error=new Error(data.msg||data.error_description||data.message||data.error||("Update failed (HTTP "+response.status+")"));
    error.code=data.error_code||data.code||data.error||"";
    throw error;
   }
   form.hidden=true;password.value="";confirm.value="";
   setStatus("Password updated successfully. Return to BatchSave Pro and sign in with the new password.","success");
  }catch(err){
   const code=String(err?.code||"");
   const message=String(err?.message||err||"Password update failed.");
   if(code==="same_password"){
    setStatus("The new password is identical to the current password. Choose a different password.","error");
   }else if(/expired|invalid.*token|jwt/i.test(message)){
    setStatus("This recovery link has expired or was already used. Request a new reset email from BatchSave Pro.","error");
   }else{
    setStatus("Password update failed: "+message,"error");
   }
   submit.disabled=false;submit.textContent="Update password";
  }
 });
})();
</script>
</body>
</html>`;
 return new Response(html,{
  status:200,
  headers:{
   "content-type":"text/html; charset=utf-8",
   "content-security-policy":`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src ${project}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
   "referrer-policy":"no-referrer",
   "cache-control":"no-store, max-age=0",
   "x-content-type-options":"nosniff",
   "x-frame-options":"DENY"
  }
 });
});