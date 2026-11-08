Deno.serve((req)=>{
 if(req.method!=="GET")return new Response("Method not allowed",{status:405});
 const project="https://gcfyaaqqsqrjwujpymjz.supabase.co";
 const key="sb_publishable_S2ErUIpwWy-lmia3pEHwsw_803Cbb9Q";
 const nonce=crypto.randomUUID().replace(/-/g,"");
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BatchSave Pro — reset password</title><style>body{font:15px system-ui,sans-serif;background:#f2f6fe;color:#1e2e49;min-height:90vh;display:grid;place-items:center}.card{width:min(430px,90vw);padding:28px;background:white;border:1px solid #dbe4f2;border-radius:15px;box-shadow:0 10px 34px #263e6c16}h1{font-size:22px;margin:0 0 12px}input,button{box-sizing:border-box;width:100%;padding:12px;border-radius:9px;margin:8px 0;font:inherit}input{border:1px solid #d5dfeb}button{border:0;background:#2d63e6;color:white;font-weight:700;cursor:pointer}p{line-height:1.6;color:#52657f}</style></head>
 <body><div class="card"><h1 id="heading">BatchSave Pro</h1><p id="message">Checking your recovery link…</p><form id="form" hidden><input id="password" type="password" autocomplete="new-password" minlength="8" required placeholder="New password (8+ characters)"><button type="submit">Update password</button></form></div>
 <script nonce="${nonce}">
 const result=new URLSearchParams(location.search).get("result");
 const params=new URLSearchParams(location.hash.slice(1));
 const token=params.get("access_token"),type=params.get("type"),error=params.get("error_description")||params.get("error");
 history.replaceState(null,"",location.pathname);
 const info=document.getElementById("message"),form=document.getElementById("form"),heading=document.getElementById("heading");
 if(error){heading.textContent="Link error";info.textContent="Recovery link error: "+error;}
 else if(!token||type!=="recovery"){
 heading.textContent=result==="success"?"Subscription started":result==="cancel"?"Checkout canceled":result==="email-confirmed"?"Email confirmed":"BatchSave Pro";
 info.textContent=result==="success"?"Your subscription is being synchronized. Return to BatchSave Pro.":result==="cancel"?"No purchase was made. Return to BatchSave Pro.":"Return to BatchSave Pro and sign in using your email and password.";
 }
 else{heading.textContent="Reset your password";info.textContent="Choose a new password. Then return to the BatchSave Pro Chrome extension and sign in.";form.hidden=false;}
 form.addEventListener("submit",async e=>{
 e.preventDefault();const password=document.getElementById("password").value;
 if(password.length<8){info.textContent="Use a password of at least 8 characters.";return;}
 const button=form.querySelector("button");button.disabled=true;
 try{
 const response=await fetch("${project}/auth/v1/user",{method:"PUT",headers:{"apikey":"${key}","Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({password})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.msg||data.error_description||data.message||"Update failed");
 form.hidden=true;heading.textContent="Password updated";info.textContent="Return to BatchSave Pro and sign in with your new password.";
 }catch(err){info.textContent=err.message;button.disabled=false;}
 });
 </script></body></html>`;
 return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","content-security-policy":`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src ${project}; base-uri 'none'; form-action 'none'`,"referrer-policy":"no-referrer","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY"}});
});