const RECOVERY_PAGE="https://plamensve.github.io/DS_ML_DL_PORTFOLIO/batchsave/account-recovery.html";

Deno.serve((req)=>{
 if(req.method!=="GET"){
  return new Response("Method not allowed",{
   status:405,
   headers:{
    "Content-Type":"text/plain; charset=utf-8",
    "Allow":"GET",
    "Cache-Control":"no-store"
   }
  });
 }

 return new Response(null,{
  status:302,
  headers:{
   "Location":RECOVERY_PAGE,
   "Cache-Control":"no-store, max-age=0",
   "Referrer-Policy":"no-referrer",
   "X-Content-Type-Options":"nosniff"
  }
 });
});
