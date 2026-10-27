import type {FeatureCollection} from "geojson";
import {DATA_RETENTION_MS} from "../core/data-files.js";
/**
 * One data file set: a file's features with a name, description and tags. `onMap` sets have their own layer; `share`
 * records the one Save to Public. Records from before sets have no tags, `onMap` or `share` and are read as off the map.
 */
export type StoredDataFile={id:string;userId:string;name:string;description:string;tags:string[];onMap:boolean;share?:{id:string;tags:string[];sharedAt:number};data:FeatureCollection;createdAt:number;expiresAt:number};
export type DataFileInput={id?:string;name:string;description:string;tags?:string[];onMap?:boolean;data:FeatureCollection};
export type DataFilePatch=Partial<Pick<StoredDataFile,"name"|"description"|"tags"|"onMap"|"share"|"data">>;
export type DataFileChange={add:DataFileInput}|{update:{id:string;patch:DataFilePatch}}|{remove:string};
const normalize=(file:StoredDataFile):StoredDataFile=>({...file,tags:file.tags??[],onMap:file.onMap??false});
export function createDataFileStorage(databaseName:string){
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open(databaseName,1);
 request.onupgradeneeded=()=>{request.result.createObjectStore("files",{keyPath:"id"}).createIndex("userId","userId");};
 request.onerror=()=>reject(new Error("เปิดที่เก็บข้อมูลไม่สำเร็จ"));request.onblocked=()=>reject(new Error("ที่เก็บข้อมูลถูกใช้งานอยู่ กรุณาปิดแท็บอื่นแล้วลองใหม่"));
 request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
});
const overLimit=(files:readonly StoredDataFile[])=>files.length>20||files.reduce((sum,file)=>sum+file.data.features.length,0)>10000||new Blob([JSON.stringify(files)]).size>20*1024*1024;
/** Atomic read/check/write, newest set first; success means the IndexedDB transaction committed. */
async function dataFileTransaction(userId:string,change?:DataFileChange,now=Date.now()):Promise<StoredDataFile[]>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("files","readwrite");const store=tx.objectStore("files");let files:StoredDataFile[]=[];let failure:Error|undefined;
  const fail=(error:Error)=>{failure=error;tx.abort();};
  const request=store.index("userId").getAll(userId);
  request.onsuccess=()=>{
   const all=(request.result as StoredDataFile[]).map(normalize);
   all.filter(file=>file.expiresAt<=now).forEach(file=>store.delete(file.id));
   files=all.filter(file=>file.expiresAt>now);
   if(change&&"remove" in change){files=files.filter(file=>file.id!==change.remove);if(all.some(file=>file.id===change.remove))store.delete(change.remove);}
   if(change&&"update" in change){
    const current=files.find(file=>file.id===change.update.id);
    if(!current)return fail(new Error("ไม่พบชุดข้อมูล ชุดอาจหมดอายุแล้ว"));
    const record={...current,...change.update.patch};
    const next=files.map(file=>file.id===record.id?record:file);
    if(change.update.patch.data&&overLimit(next))return fail(new Error("เกินขีดจำกัดรวม 20 ชุด / 10,000 รายการ / 20 MB กรุณาลบชุดเดิมก่อน"));
    files=next;store.put(record);
   }
   if(change&&"add" in change){
    const {id=crypto.randomUUID(),tags=[],onMap=false,...input}=change.add;
    const record:StoredDataFile={...input,id,tags,onMap,userId,createdAt:now,expiresAt:now+DATA_RETENTION_MS};
    const next=[...files,record];
    if(overLimit(next))return fail(new Error("เกินขีดจำกัดรวม 20 ชุด / 10,000 รายการ / 20 MB กรุณาลบชุดเดิมก่อน"));
    files=next;store.add(record);
   }
   files.sort((a,b)=>b.createdAt-a.createdAt);
  };
  tx.oncomplete=()=>{db.close();resolve(files);};tx.onabort=()=>{db.close();reject(failure??new Error("บันทึกไม่สำเร็จ พื้นที่อาจเต็มหรือเบราว์เซอร์ไม่อนุญาต"));};tx.onerror=()=>{};
 });
}

return dataFileTransaction;
}
