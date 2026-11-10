const STATUS_PAGE="https://plamensve.github.io/DS_ML_DL_PORTFOLIO/batchsave/account-status.html";

Deno.serve((req)=>{
 if(req.method!=="GET"){
  return new Response("Method not allowed",{status:405,headers:{"Allow":"GET","Cache-Control":"no-store"}});
 }
 const incoming=new URL(req.url);
 const target=new URL(incoming.searchParams.get("result")==="email-confirmed" ? "https://batchsavepro.com/signup-confirmed.html" : STATUS_PAGE);
 const result=incoming.searchParams.get("result");
 if(result)target.searchParams.set("result",result);
 return new Response(null,{
  status:302,
  headers:{
   "Location":target.toString(),
   "Cache-Control":"no-store, max-age=0",
   "Referrer-Policy":"no-referrer",
   "X-Content-Type-Options":"nosniff"
  }
 });
});
