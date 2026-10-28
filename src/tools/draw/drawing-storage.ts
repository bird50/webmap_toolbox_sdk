import type {Drawing} from "./drawing.js";
import {drawingCollection} from "../../contracts/drawing-contract.js";
const retention=15*86400000;
/**
 * A named drawing set kept in this browser for 15 days from its last save. `onMap` decides whether it has a layer;
 * `share` records its Public save.
 */
export type DrawingSet={id:string;userId:string;name:string;tags:string[];drawings:Drawing[];onMap:boolean;createdAt:number;expiresAt:number;share?:{id:string;tags:string[];sharedAt:number}};
/** Name of the set that collects drawings saved before sets existed. */
export const LEGACY_DRAWING_SET="My Drawing เดิม";
const checkSize=(drawings:Drawing[])=>{drawingCollection.parse(drawings);if(new Blob([JSON.stringify(drawings)]).size>1024*1024)throw new Error("ข้อมูลเกิน 1 MB");};

/**
 * The callable store keeps one draft per user (the Drawing Toolbar's canvas); `loadSets`, `saveSet`, `updateSet` and
 * `deleteSet` keep the user's named sets. Version 2 moves an existing draft into the set `LEGACY_DRAWING_SET`, on the map.
 */
export function createDrawingStorage(databaseName:string){
async function open(){return new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open(databaseName,2);
 request.onupgradeneeded=event=>{
  const db=request.result,tx=request.transaction!;
  if(event.oldVersion<1)db.createObjectStore("workspaces",{keyPath:"userId"});
  if(event.oldVersion<2){
   const sets=db.createObjectStore("sets",{keyPath:"id"});sets.createIndex("userId","userId");
   if(event.oldVersion>=1){
    const read=tx.objectStore("workspaces").getAll();
    read.onsuccess=()=>{
     for(const row of read.result as {userId:string;drawings:Drawing[];expiresAt:number}[]){
      if(row.expiresAt>Date.now()&&row.drawings?.length)sets.add({id:crypto.randomUUID(),userId:row.userId,name:LEGACY_DRAWING_SET,tags:[],drawings:row.drawings,onMap:true,createdAt:Date.now(),expiresAt:row.expiresAt} satisfies DrawingSet);
      tx.objectStore("workspaces").delete(row.userId);
     }
    };
   }
  }
 };
 request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
 request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error("Storage blocked"));
});}
async function drawingStorage(userId:string,drawings?:Drawing[]):Promise<{drawings:Drawing[];expiresAt:number|null}>{
 if(drawings)checkSize(drawings);
 const db=await open();
 return new Promise((resolve,reject)=>{
 const tx=db.transaction("workspaces","readwrite"),store=tx.objectStore("workspaces");let result:{drawings:Drawing[];expiresAt:number|null}={drawings:[],expiresAt:null};
 if(drawings){result={drawings,expiresAt:Date.now()+retention};store.put({...result,userId});}
 else {const request=store.get(userId);request.onsuccess=()=>{const row=request.result;if(row?.expiresAt>Date.now()){const parsed=drawingCollection.safeParse(row.drawings);if(parsed.success)result={drawings:parsed.data,expiresAt:row.expiresAt};else tx.abort();}else if(row)store.delete(userId);};}
 tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=()=>{db.close();reject(new Error("อ่าน/บันทึกรูปวาดบนเครื่องไม่สำเร็จ"));};tx.onerror=()=>{};
 });
}
async function setTransaction<T>(run:(store:IDBObjectStore,done:(value:T)=>void,fail:(error:Error)=>void)=>void):Promise<T>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("sets","readwrite");let value:T;let failure:Error|undefined;
  run(tx.objectStore("sets"),result=>{value=result;},error=>{failure=error;tx.abort();});
  tx.oncomplete=()=>{db.close();resolve(value);};
  tx.onabort=()=>{db.close();reject(failure??tx.error??new Error("Storage transaction failed"));};
  tx.onerror=()=>{};
 });
}
/** The user's sets, newest first; expired sets are deleted. */
function loadSets(userId:string,now=Date.now()):Promise<DrawingSet[]>{
 return setTransaction((store,done)=>{
  const read=store.index("userId").getAll(userId);
  read.onsuccess=()=>{
   const sets:DrawingSet[]=[];
   for(const set of read.result as DrawingSet[]){if(set.expiresAt<=now)store.delete(set.id);else sets.push(set);}
   done(sets.sort((a,b)=>b.createdAt-a.createdAt));
  };
 });
}
function saveSet(userId:string,input:{name:string;tags:string[];drawings:Drawing[]},now=Date.now()):Promise<DrawingSet>{
 checkSize(input.drawings);
 const set:DrawingSet={id:crypto.randomUUID(),userId,name:input.name,tags:[...input.tags],drawings:input.drawings,onMap:false,createdAt:now,expiresAt:now+retention};
 return setTransaction((store,done)=>{store.add(set);done(set);});
}
/** Changes a set; new drawings restart its 15 days. Only the owner's sets change. */
function updateSet(userId:string,id:string,patch:Partial<Pick<DrawingSet,"name"|"tags"|"drawings"|"onMap"|"share">>,now=Date.now()):Promise<DrawingSet>{
 if(patch.drawings)checkSize(patch.drawings);
 return setTransaction((store,done,fail)=>{
  const read=store.get(id);
  read.onsuccess=()=>{
   const set=read.result as DrawingSet|undefined;
   if(!set||set.userId!==userId){fail(new Error("ไม่พบชุดรูปวาด"));return;}
   const next={...set,...patch,...(patch.drawings?{expiresAt:now+retention}:{})};store.put(next);done(next);
  };
 });
}
function deleteSet(userId:string,id:string):Promise<void>{
 return setTransaction((store,done)=>{const read=store.get(id);read.onsuccess=()=>{if((read.result as DrawingSet|undefined)?.userId===userId)store.delete(id);done(undefined);};});
}
return Object.assign(drawingStorage,{loadSets,saveSet,updateSet,deleteSet});
}
export type DrawingStorage=ReturnType<typeof createDrawingStorage>;
