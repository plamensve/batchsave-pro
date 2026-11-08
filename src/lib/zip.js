// ZIP format writer (STORE method): no network dependencies or external services.
// Input files are already-compressed images/PDFs in most workflows.
const enc = new TextEncoder();
const table = new Uint32Array(256);
for (let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
export function crc32(data) {
 let crc=0xffffffff;
 for(const byte of data) crc=table[(crc^byte)&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
function safeName(name) {
 const cleaned=String(name||"file").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/^\.+/,"").slice(0,160);
 return cleaned||"file";
}
function dosTimeDate(date) {
 const year=Math.max(1980,Math.min(2107,date.getFullYear()));
 return {time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2),
         day:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};
}
function header(length){return new DataView(new ArrayBuffer(length));}
const bytes=view=>new Uint8Array(view.buffer);
const set16=(v,offset,value)=>v.setUint16(offset,value,true);
const set32=(v,offset,value)=>v.setUint32(offset,value,true);
export function makeZip(entries,date=new Date()) {
 if(!entries.length)throw Error("Select at least one file.");
 if(entries.length>150)throw Error("ZIP supports up to 150 files per archive.");
 const {time,day}=dosTimeDate(date);
 const parts=[],central=[];let offset=0,total=0;const names=new Set();
 for(const entry of entries){
   if(!(entry.bytes instanceof Uint8Array))throw TypeError("ZIP entry must contain a Uint8Array.");
   total+=entry.bytes.byteLength;
   if(total>100*1024*1024)throw Error("ZIP archive exceeds 100 MB. Download files separately.");
   let name=safeName(entry.name),i=2;
   while(names.has(name.toLowerCase())){
     const dot=name.lastIndexOf("."),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):"";
     name=`${stem.slice(0,125)} (${i++})${ext}`;
   }
   names.add(name.toLowerCase());
   const filename=enc.encode(name),data=entry.bytes,crc=crc32(data);
   if(filename.length>65535)throw Error("Filename is too long.");
   const local=header(30);
   set32(local,0,0x04034b50);set16(local,4,20);set16(local,6,0x0800);
   set16(local,8,0);set16(local,10,time);set16(local,12,day);
   set32(local,14,crc);set32(local,18,data.byteLength);set32(local,22,data.byteLength);
   set16(local,26,filename.length);set16(local,28,0);
   parts.push(bytes(local),filename,data);
   const cd=header(46);
   set32(cd,0,0x02014b50);set16(cd,4,20);set16(cd,6,20);set16(cd,8,0x0800);
   set16(cd,10,0);set16(cd,12,time);set16(cd,14,day);
   set32(cd,16,crc);set32(cd,20,data.byteLength);set32(cd,24,data.byteLength);
   set16(cd,28,filename.length);set16(cd,30,0);set16(cd,32,0);set16(cd,34,0);
   set16(cd,36,0);set32(cd,38,0);set32(cd,42,offset);
   central.push(bytes(cd),filename);
   offset+=30+filename.length+data.byteLength;
 }
 const centralSize=central.reduce((sum,p)=>sum+p.byteLength,0);
 const end=header(22);
 set32(end,0,0x06054b50);set16(end,4,0);set16(end,6,0);
 set16(end,8,entries.length);set16(end,10,entries.length);
 set32(end,12,centralSize);set32(end,16,offset);set16(end,20,0);
 return new Blob([...parts,...central,bytes(end)],{type:"application/zip"});
}
