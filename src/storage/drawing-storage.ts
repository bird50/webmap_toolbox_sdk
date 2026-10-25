import type {Drawing} from "../core/drawing.js";
import {drawingCollection} from "../core/drawing-contract.js";
const retention=15*86400000;
export function createDrawingStorage(databaseName:string){
async function open(){return new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open(databaseName,1);
 request.onupgradeneeded=()=>request.result.createObjectStore("workspaces",{keyPath:"userId"});
 request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
 request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error("Storage blocked"));
});}
async function drawingStorage(userId:string,drawings?:Drawing[]):Promise<{drawings:Drawing[];expiresAt:number|null}>{
 if(drawings){drawingCollection.parse(drawings);if(new Blob([JSON.stringify(drawings)]).size>1024*1024)throw new Error("ข้อมูลเกิน 1 MB");}
 const db=await open();
 return new Promise((resolve,reject)=>{
 const tx=db.transaction("workspaces","readwrite"),store=tx.objectStore("workspaces");let result:{drawings:Drawing[];expiresAt:number|null}={drawings:[],expiresAt:null};
 if(drawings){result={drawings,expiresAt:Date.now()+retention};store.put({...result,userId});}
 else {const request=store.get(userId);request.onsuccess=()=>{const row=request.result;if(row?.expiresAt>Date.now()){const parsed=drawingCollection.safeParse(row.drawings);if(parsed.success)result={drawings:parsed.data,expiresAt:row.expiresAt};else tx.abort();}else if(row)store.delete(userId);};}
 tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=()=>{db.close();reject(new Error("อ่าน/บันทึกรูปวาดบนเครื่องไม่สำเร็จ"));};tx.onerror=()=>{};
 });
}

return drawingStorage;
}
