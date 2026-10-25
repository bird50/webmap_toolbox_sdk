import type {GeotaggedPhoto} from "../core/photo-gps.js";

export const PHOTO_RETENTION_MS=15*24*60*60*1000;
export type StoredPhoto={id:string;userId:string;name:string;blob:Blob;longitude:number;latitude:number;createdAt:number;expiresAt:number};

export function createPhotoStorage(databaseName:string) {
function openDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(databaseName,1);
    request.onupgradeneeded=()=>{
      const store=request.result.createObjectStore("photos",{keyPath:"id"});
      store.createIndex("userId","userId");
      store.createIndex("expiresAt","expiresAt");
    };
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error("Storage blocked"));
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  });
}

async function loadPhotos(userId:string,now=Date.now()):Promise<{photos:StoredPhoto[];removed:number}> {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("photos","readwrite");
    const store=tx.objectStore("photos");
    const photos:StoredPhoto[]=[];
    let removed=0;
    const cursor=store.index("expiresAt").openCursor(IDBKeyRange.upperBound(now));
    cursor.onsuccess=()=>{
      const item=cursor.result;
      if(item){if(item.value.userId===userId)removed++;item.delete();item.continue();}
      else {
        const read=store.index("userId").getAll(userId);
        read.onsuccess=()=>photos.push(...read.result as StoredPhoto[]);
      }
    };
    tx.oncomplete=()=>{db.close();resolve({photos,removed});};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("Storage transaction failed"));};
    tx.onerror=()=>{};
  });
}

async function savePhotos(userId:string,photos:GeotaggedPhoto[],now=Date.now()):Promise<StoredPhoto[]> {
  const records=photos.map(({file,longitude,latitude})=>({id:crypto.randomUUID(),userId,name:file.name,blob:file,longitude,latitude,createdAt:now,expiresAt:now+PHOTO_RETENTION_MS}));
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("photos","readwrite");
    records.forEach(record=>tx.objectStore("photos").add(record));
    tx.oncomplete=()=>{db.close();resolve(records);};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("Storage transaction failed"));};
    tx.onerror=()=>{};
  });
}

return {loadPhotos,savePhotos};
}

export function formatPhotoExpiry(timestamp:number) {
  return new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"}).format(timestamp);
}
