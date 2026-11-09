Deno.serve((req)=>{
  if(req.method!=="GET"){
    return new Response("Method not allowed",{status:405,headers:{"Content-Type":"text/plain; charset=utf-8"}});
  }
  const target="https://plamensve.github.io/DS_ML_DL_PORTFOLIO/batchsave/account-recovery.html";
  return new Response(null,{
    status:302,
    headers:{
      "Location":target,
      "Cache-Control":"no-store, max-age=0",
      "Referrer-Policy":"no-referrer",
      "X-Content-Type-Options":"nosniff"
    }
  });
});