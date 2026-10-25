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
