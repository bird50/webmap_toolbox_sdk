import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {createLayerRegistry} from '../src/core/registry.js';
import {createBrowserStorage} from '../src/storage/index.js';
import {createPublicClient} from '../src/core/client.js';
import {createMapLibreAdapter} from '../src/adapters/maplibre.js';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {defaultDrawingStyle} from '../src/core/drawing.js';
import type {LayerDefinition} from '../src/core/layers.js';
const layer:LayerDefinition={id:'test',title:'Test',description:'',group:'test',type:'GEOJSON',url:'local:test',visible:false,opacity:1,minZoom:0,maxZoom:24,accessLevel:'MEMBER',color:'#dc2626',legend:'test',popupFields:[]};
test('one registry drives layer and toolbox state; denied layers and invalid orders never enter state',()=>{
 const store=createLayerRegistry([layer,{...layer,id:'admin',accessLevel:'ADMIN'}],'MEMBER');let changes=0;const cleanup=store.subscribe(()=>changes++);
 assert.equal(store.getSnapshot().layers.length,1);store.setVisible('test',true);store.setOpacity('test',2);assert.equal(store.getSnapshot().visible.test,true);assert.equal(store.getSnapshot().opacity.test,1);store.setVisible('unknown',true);assert.equal(store.getSnapshot().visible.unknown,undefined);
 assert.throws(()=>store.register(layer));store.register({...layer,id:'other'});store.reorder(['other','test']);assert.equal(store.getSnapshot().layers[0].id,'other');assert.throws(()=>store.reorder(['test','test']));cleanup();const count=changes;store.unregister('test');assert.equal(changes,count);
});
test('IndexedDB scopes apps and users, preserves blobs and expires without extending on reads',async()=>{
 const a=createBrowserStorage('app-a'),b=createBrowserStorage('app-b');const photo={file:new File(['image'],'photo.jpg',{type:'image/jpeg'}),longitude:100,latitude:13};
 await a.photos.savePhotos('alice',[photo],1000);
 assert.equal((await a.photos.loadPhotos('alice',1001)).photos.length,1);assert.equal(await (await a.photos.loadPhotos('alice',1001)).photos[0].blob.text(),'image');
 assert.equal((await a.photos.loadPhotos('bob',1001)).photos.length,0);assert.equal((await b.photos.loadPhotos('alice',1001)).photos.length,0);
 assert.equal((await a.photos.loadPhotos('alice',1000+15*86400000)).removed,1);
 const drawing={id:crypto.randomUUID(),tool:'point' as const,points:[[100,13] as [number,number]],text:'sample',style:defaultDrawingStyle,boxWidth:200,boxHeight:100};await a.drawings('alice',[drawing]);assert.equal((await a.drawings('alice')).drawings[0].text,'sample');assert.deepEqual((await b.drawings('alice')).drawings,[]);assert.deepEqual((await a.drawings('bob')).drawings,[]);
});
test('configured gateway is used and events are instance scoped; no service key',async()=>{
 let seen='';let headers:Headers|undefined;const client=createPublicClient({baseUrl:'https://app.example',fetch:async(input,init)=>{seen=String(input);headers=new Headers(init?.headers);return Response.json({});}});let count=0;const unsubscribe=client.subscribe('photos',()=>count++);client.notify('photos');unsubscribe();client.notify('photos');assert.equal(count,1);
 await client.request('photos',{},new URLSearchParams({bbox:'90,0,110,20'}));assert.equal(seen,'https://app.example/api/public/photos?bbox=90%2C0%2C110%2C20');assert.equal(headers?.has('authorization'),false);
});
test('adapter removes only its own listeners and validates navigation',()=>{
 let attached=0,removed=0;const map={on(){attached++;},off(){removed++;},flyTo(){}} as unknown as MapLibreMap;
 const adapter=createMapLibreAdapter(()=>map);const fn=()=>{};adapter.on('move',fn);adapter.on('resize',fn);adapter.off('move',fn);adapter.dispose();assert.equal(attached,2);assert.equal(removed,2);assert.throws(()=>adapter.navigate({longitude:999,latitude:0,zoom:3}));
});
test('photo events: owner-scoped, cleaned when photos expire, and v1 databases keep their photos on the map',async()=>{
 const storage=createBrowserStorage('events-app');const file=(name:string)=>({file:new File([name],name,{type:'image/jpeg'}),longitude:100,latitude:13});
 const [a]=await storage.photos.savePhotos('alice',[file('a.jpg')],1000),[b]=await storage.photos.savePhotos('alice',[file('b.jpg')],5000);
 const event=await storage.photos.saveEvent('alice',{name:'flood',tags:['x'],photoIds:[a.id,b.id,a.id]},6000);
 assert.deepEqual([event.photoIds.length,event.onMap],[2,false]);
 const [c]=await storage.photos.savePhotos('alice',[{...file('c.jpg'),caption:'  ตลิ่งพัง  '}],6000);
 assert.equal(c.caption,'ตลิ่งพัง','captions are trimmed when saved');
 await assert.rejects(storage.photos.setCaption('bob',c.id,'x'),'only the owner changes a caption');
 assert.equal((await storage.photos.setCaption('alice',c.id,' ใหม่ ')).caption,'ใหม่');
 const cleared=await storage.photos.setCaption('alice',c.id,' ');
 assert.equal('caption' in cleared,false,'an empty caption is removed');
 assert.equal(cleared.expiresAt,c.expiresAt,'editing keeps the expiry');
 await assert.rejects(storage.photos.updateEvent('bob',event.id,{onMap:true}));
 assert.equal((await storage.photos.updateEvent('alice',event.id,{onMap:true})).onMap,true);
 await storage.photos.deleteEvent('bob',event.id);
 assert.equal((await storage.photos.loadPhotos('alice',6000)).events.length,1,'others cannot delete it');
 assert.deepEqual((await storage.photos.loadPhotos('alice',1000+15*86400000)).events[0].photoIds,[b.id],'expired photos leave the set');
 assert.equal((await storage.photos.loadPhotos('alice',5000+15*86400000)).events.length,0,'an empty set is removed');
 // A database created by SDK 1.x (version 1, photos only).
 await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('legacy-photos',1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore('photos',{keyPath:'id'});store.createIndex('userId','userId');store.createIndex('expiresAt','expiresAt');store.add({id:'p1',userId:'alice',name:'old.jpg',blob:new Blob(['o']),longitude:100,latitude:13,createdAt:1,expiresAt:Date.now()+86400000});};request.onsuccess=()=>{request.result.close();resolve();};request.onerror=()=>reject(request.error);});
 const {createPhotoStorage,LEGACY_PHOTO_EVENT}=await import('../src/storage/photo-storage.js');
 const legacy=await createPhotoStorage('legacy-photos').loadPhotos('alice');
 assert.deepEqual(legacy.events.map(event=>[event.name,event.photoIds,event.onMap]),[[LEGACY_PHOTO_EVENT,['p1'],true]]);
});
