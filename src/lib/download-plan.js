export function downloadPlan(files,source){
 const count=Array.isArray(files)?files.length:0;
 if(!count)return {mode:"none",count:0};
 if(count>1)return {mode:"zip",count};
 if(source==="gmail-visible")return {mode:"gmail-visible-single",count};
 if(source==="gmail")return {mode:"gmail-api-single",count};
 return {mode:"page-single",count};
}
