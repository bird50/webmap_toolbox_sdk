import type {GeotaggedPhoto} from "../../contracts/photo-gps.js";

export const PHOTO_RETENTION_MS=15*24*60*60*1000;
/** `caption` is the user's text for the photo (absent in photos saved before 1.4). */
export type StoredPhoto={id:string;userId:string;name:string;blob:Blob;longitude:number;latitude:number;createdAt:number;expiresAt:number;caption?:string};
/**
 * A named set of My Photos kept in this browser. `onMap` decides whether its photos are drawn on the My Photos layer;
 * `share` records the Public upload of the set. An event ends when its last photo expires.
 */
export type PhotoEvent={id:string;userId:string;name:string;tags:string[];photoIds:string[];onMap:boolean;createdAt:number;share?:{url:string;tags:string[];sharedAt:number}};
/** Name given to the event that collects photos saved before events existed. */
export const LEGACY_PHOTO_EVENT="My Photos เดิม";

export function createPhotoStorage(databaseName:string) {
function openDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(databaseName,2);
    request.onupgradeneeded=event=>{
      const db=request.result,tx=request.transaction!;
      if(event.oldVersion<1){
        const store=db.createObjectStore("photos",{keyPath:"id"});
        store.createIndex("userId","userId");
        store.createIndex("expiresAt","expiresAt");
      }
      if(event.oldVersion<2){
        const events=db.createObjectStore("events",{keyPath:"id"});
        events.createIndex("userId","userId");
        // v2: only photos in an event added to the map are drawn, so existing photos keep showing in one event per user.
        if(event.oldVersion>=1){
          const read=tx.objectStore("photos").getAll();
          read.onsuccess=()=>{
            const byUser=new Map<string,string[]>();
            for(const photo of read.result as StoredPhoto[])byUser.set(photo.userId,[...byUser.get(photo.userId)??[],photo.id]);
            for(const [userId,photoIds] of byUser)events.add({id:crypto.randomUUID(),userId,name:LEGACY_PHOTO_EVENT,tags:[],photoIds,onMap:true,createdAt:Date.now()} satisfies PhotoEvent);
          };
        }
      }
    };
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error("Storage blocked"));
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  });
}

/** Removes expired photos, drops them from events (deleting events left empty) and returns the user's photos and events. */
async function loadPhotos(userId:string,now=Date.now()):Promise<{photos:StoredPhoto[];removed:number;events:PhotoEvent[]}> {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(["photos","events"],"readwrite");
    const store=tx.objectStore("photos");
    const photos:StoredPhoto[]=[],events:PhotoEvent[]=[];
    let removed=0;
    const cursor=store.index("expiresAt").openCursor(IDBKeyRange.upperBound(now));
    cursor.onsuccess=()=>{
      const item=cursor.result;
      if(item){if(item.value.userId===userId)removed++;item.delete();item.continue();}
      else {
        const read=store.index("userId").getAll(userId);
        read.onsuccess=()=>{
          photos.push(...read.result as StoredPhoto[]);
          const kept=new Set(photos.map(photo=>photo.id)),eventStore=tx.objectStore("events");
          const saved=eventStore.index("userId").getAll(userId);
          saved.onsuccess=()=>{
            for(const event of saved.result as PhotoEvent[]){
              const photoIds=event.photoIds.filter(id=>kept.has(id));
              if(!photoIds.length){eventStore.delete(event.id);continue;}
              if(photoIds.length!==event.photoIds.length)eventStore.put({...event,photoIds});
              events.push({...event,photoIds});
            }
            events.sort((a,b)=>b.createdAt-a.createdAt);
          };
        };
      }
    };
    tx.oncomplete=()=>{db.close();resolve({photos,removed,events});};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("Storage transaction failed"));};
    tx.onerror=()=>{};
  });
}

async function savePhotos(userId:string,photos:(GeotaggedPhoto&{caption?:string})[],now=Date.now()):Promise<StoredPhoto[]> {
  const records:StoredPhoto[]=photos.map(({file,longitude,latitude,caption})=>({id:crypto.randomUUID(),userId,name:file.name,blob:file,longitude,latitude,createdAt:now,expiresAt:now+PHOTO_RETENTION_MS,...(caption?.trim()?{caption:caption.trim()}:{})}));
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("photos","readwrite");
    records.forEach(record=>tx.objectStore("photos").add(record));
    tx.oncomplete=()=>{db.close();resolve(records);};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("Storage transaction failed"));};
    tx.onerror=()=>{};
  });
}

/** Changes a photo's caption (empty removes it). Only the owner's photos change; the expiry stays. */
async function setCaption(userId:string,id:string,caption:string):Promise<StoredPhoto>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("photos","readwrite"),store=tx.objectStore("photos");let next:StoredPhoto|undefined;
    const read=store.get(id);
    read.onsuccess=()=>{
      const photo=read.result as StoredPhoto|undefined;
      if(!photo||photo.userId!==userId){tx.abort();return;}
      const {caption:_old,...rest}=photo;void _old;
      next=caption.trim()?{...rest,caption:caption.trim()}:rest;store.put(next);
    };
    tx.oncomplete=()=>{db.close();resolve(next!);};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("ไม่พบรูป"));};
    tx.onerror=()=>{};
  });
}
/** Deletes the owner's photos with these IDs (others' are left alone). Events keep their lists; callers prune them. */
async function deletePhotos(userId:string,ids:readonly string[]):Promise<void>{
  if(!ids.length)return;
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("photos","readwrite"),store=tx.objectStore("photos");
    for(const id of ids){const read=store.get(id);read.onsuccess=()=>{if((read.result as StoredPhoto|undefined)?.userId===userId)store.delete(id);};}
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("Storage transaction failed"));};
    tx.onerror=()=>{};
  });
}
async function eventTransaction<T>(run:(store:IDBObjectStore,done:(value:T)=>void,fail:(error:Error)=>void)=>void):Promise<T>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    let result:T,failure:Error|undefined;
    const tx=db.transaction("events","readwrite");
    run(tx.objectStore("events"),value=>{result=value;},error=>{failure=error;tx.abort();});
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onabort=()=>{db.close();reject(failure??tx.error??new Error("Storage transaction failed"));};
    tx.onerror=()=>{};
  });
}
function saveEvent(userId:string,input:{name:string;tags:string[];photoIds:string[]},now=Date.now()):Promise<PhotoEvent>{
  const event:PhotoEvent={id:crypto.randomUUID(),userId,name:input.name,tags:[...input.tags],photoIds:[...new Set(input.photoIds)],onMap:false,createdAt:now};
  return eventTransaction((store,done)=>{store.add(event);done(event);});
}
/** Changes an event's name, tags, photos or whether it is on the map, or records its Public save. Only the owner's events change. */
function updateEvent(userId:string,id:string,patch:Partial<Pick<PhotoEvent,"onMap"|"share"|"photoIds"|"name"|"tags">>):Promise<PhotoEvent>{
  return eventTransaction((store,done,fail)=>{
    const read=store.get(id);
    read.onsuccess=()=>{
      const event=read.result as PhotoEvent|undefined;
      if(!event||event.userId!==userId){fail(new Error("ไม่พบชุดเหตุการณ์"));return;}
      const next={...event,...patch,...(patch.photoIds?{photoIds:[...new Set(patch.photoIds)]}:{})};store.put(next);done(next);
    };
  });
}
/** Deletes the event only; its photos stay in My Photos. */
function deleteEvent(userId:string,id:string):Promise<void>{
  return eventTransaction((store,done)=>{
    const read=store.get(id);
    read.onsuccess=()=>{if((read.result as PhotoEvent|undefined)?.userId===userId)store.delete(id);done(undefined);};
  });
}

return {loadPhotos,savePhotos,setCaption,deletePhotos,saveEvent,updateEvent,deleteEvent};
}

/** @deprecated use formatExpiry from the storage entry. */
export {formatExpiry as formatPhotoExpiry} from "../../storage/expiry.js";
