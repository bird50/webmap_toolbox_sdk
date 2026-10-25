import type {FeatureCollection} from "geojson";
import {DATA_RETENTION_MS} from "../core/data-files.js";
export type StoredDataFile={id:string;userId:string;name:string;description:string;data:FeatureCollection;createdAt:number;expiresAt:number};
export function createDataFileStorage(databaseName:string){
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open(databaseName,1);
 request.onupgradeneeded=()=>{request.result.createObjectStore("files",{keyPath:"id"}).createIndex("userId","userId");};
 request.onerror=()=>reject(new Error("เปิดที่เก็บข้อมูลไม่สำเร็จ"));request.onblocked=()=>reject(new Error("ที่เก็บข้อมูลถูกใช้งานอยู่ กรุณาปิดแท็บอื่นแล้วลองใหม่"));
 request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
});
/** Atomic read/check/write; success means the IndexedDB transaction committed. */
async function dataFileTransaction(userId:string,change?:{add:{name:string;description:string;data:FeatureCollection}}|{remove:string},now=Date.now()):Promise<StoredDataFile[]>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("files","readwrite");const store=tx.objectStore("files");let files:StoredDataFile[]=[];let failure:Error|undefined;
  const request=store.index("userId").getAll(userId);
  request.onsuccess=()=>{
   const all=request.result as StoredDataFile[];
   all.filter(file=>file.expiresAt<=now).forEach(file=>store.delete(file.id));
   files=all.filter(file=>file.expiresAt>now);
   if(change&&"remove" in change){files=files.filter(file=>file.id!==change.remove);if(all.some(file=>file.id===change.remove))store.delete(change.remove);}
   if(change&&"add" in change){
    const record={...change.add,id:crypto.randomUUID(),userId,createdAt:now,expiresAt:now+DATA_RETENTION_MS};
    const next=[...files,record];
    if(next.length>20||next.reduce((sum,file)=>sum+file.data.features.length,0)>10000||new Blob([JSON.stringify(next)]).size>20*1024*1024){failure=new Error("เกินขีดจำกัดรวม 20 ไฟล์ / 10,000 รายการ / 20 MB กรุณาลบไฟล์เดิมก่อน");tx.abort();return;}
    files=next;store.add(record);
   }
  };
  tx.oncomplete=()=>{db.close();resolve(files);};tx.onabort=()=>{db.close();reject(failure??new Error("บันทึกไม่สำเร็จ พื้นที่อาจเต็มหรือเบราว์เซอร์ไม่อนุญาต"));};tx.onerror=()=>{};
 });
}

return dataFileTransaction;
}
