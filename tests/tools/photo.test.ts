import {test} from 'node:test';
import assert from 'node:assert/strict';
import {h,act,createRoot,createLayerRegistry,createPublicClient,createBrowserStorage,ui,ToolboxPanel,ToolOverlays,ToolDialogs,nextId,runtime,layer,fakeMap,settle,dom,render,click} from '../helpers/dom.js';
import type {ToolboxRuntime} from '../../src/ui/context.js';

const {createPhotoTool}=await import('../../src/tools/photo/plugin.js');

test('photo: the controller restores My Photos with object URLs and revokes them on unmount',async()=>{
 const rt=runtime(),{map}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 await rt.storage.photos.savePhotos('u4',[{file:new File(['x'],'a.jpg',{type:'image/jpeg'}),longitude:100,latitude:13}]);
 const created:string[]=[],revoked:string[]=[];
 const {createObjectURL,revokeObjectURL}=URL;
 URL.createObjectURL=()=>{const url=`blob:test/${created.length}`;created.push(url);return url;};URL.revokeObjectURL=url=>{revoked.push(url);};
 try{
  await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u4',accessLevel:'MEMBER'},map,plugins:[createPhotoTool(()=>null,[])]},h(ToolboxPanel)));
  assert.match(dom.container.textContent??'',/My Photos \(ชุดบนแผนที่ 0 · รูป 1\)/);
  assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.visible]),[],'no photo layer until a set is added to the map');
  act(()=>dom.root.unmount());dom.root=createRoot(dom.container);
  assert.ok(created.length>=1);
  assert.ok(created.every(url=>revoked.includes(url)),'every created URL is revoked');
 }finally{URL.createObjectURL=createObjectURL;URL.revokeObjectURL=revokeObjectURL;}
});
test('photoTool draws My Photos as HTML markers positioned through MapAdapter.project, with a popup',async()=>{
 const {photoTool}=await import('../../src/tools/photo/plugin.js');
 const rt=runtime(),{map}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 map.project=([lng,lat])=>({x:(lng-99)*100,y:(14-lat)*100});
 const [river]=await rt.storage.photos.savePhotos('u6',[{file:new File(['x'],'river.jpg',{type:'image/jpeg'}),longitude:100,latitude:13},{file:new File(['y'],'hidden.jpg',{type:'image/jpeg'}),longitude:100.5,latitude:13}]);
 // Only photos of an event added to the map are drawn.
 const event=await rt.storage.photos.saveEvent('u6',{name:'flood',tags:[],photoIds:[river.id]});await rt.storage.photos.updateEvent('u6',event.id,{onMap:true});
 const {createObjectURL,revokeObjectURL}=URL;URL.createObjectURL=()=>'blob:test/river';URL.revokeObjectURL=()=>{};
 try{
  await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u6',accessLevel:'MEMBER'},map,plugins:[photoTool()]},h(ToolOverlays)));
  const marker=document.querySelector('button[aria-label="ดูภาพ river.jpg"]') as HTMLButtonElement;
  assert.ok(marker);assert.equal(marker.style.left,'100px');assert.equal(marker.style.top,'100px');
  assert.equal(document.querySelector('button[aria-label="ดูภาพ hidden.jpg"]'),null,'photos outside an event on the map stay off it');
  click('button[aria-label="ดูภาพ river.jpg"]');
  assert.ok(document.querySelector('[role=dialog][aria-label="river.jpg"]'));
 }finally{URL.createObjectURL=createObjectURL;URL.revokeObjectURL=revokeObjectURL;}
});
/** A minimal JPEG carrying only EXIF GPS (whole degrees) and a capture date, enough for readPhotoGps. */
function gpsJpeg(name:string,longitude:number,latitude:number){
 const t=new Uint8Array(288),view=new DataView(t.buffer);
 t.set([0x49,0x49]);view.setUint16(2,42,true);view.setUint32(4,8,true);view.setUint16(8,2,true);
 const tag=(off:number,id:number,type:number,count:number,value:number)=>{view.setUint16(off,id,true);view.setUint16(off+2,type,true);view.setUint32(off+4,count,true);view.setUint32(off+8,value,true);};
 tag(10,0x8769,4,1,38);tag(22,0x8825,4,1,80);
 view.setUint16(38,1,true);tag(40,0x9003,2,20,200);t.set(new TextEncoder().encode('2026:10:18 09:30:45\0'),200);
 view.setUint16(80,4,true);tag(82,1,2,2,78);tag(94,2,5,3,240);tag(106,3,2,2,69);tag(118,4,5,3,264);
 for(const [off,value] of [[240,latitude],[248,0],[256,0],[264,longitude],[272,0],[280,0]]){view.setUint32(off,value,true);view.setUint32(off+4,1,true);}
 const payload=new Uint8Array([...new TextEncoder().encode('Exif\0\0'),...t]);
 const bytes=new Uint8Array([0xff,0xd8,0xff,0xe1,(payload.length+2)>>8,(payload.length+2)&255,...payload,0xff,0xd9]);
 return new File([bytes],name,{type:'image/jpeg'});
}
test('photo events: photos are chosen straight into a named set, Add to map shows it, photos are added and removed, Save to Public uploads it once',async()=>{
 const {photoTool}=await import('../../src/tools/photo/plugin.js');
 const posted:FormData[]=[];
 const client=createPublicClient({fetch:async(url,init)=>{if(String(url)==='/api/photo-shares'){posted.push(init?.body as FormData);return Response.json({id:'s1',url:'/share/s1',tags:['share2026-10-27','flood']},{status:201});}return Response.json({photos:[],hasMore:false});}});
 // fake-indexeddb clones happy-dom Files into plain objects; give the uploader real Blobs, as a browser's IndexedDB does.
 const base=createBrowserStorage(`events-${nextId()}`);
 const photoStore={...base.photos,async loadPhotos(userId:string,now?:number){const result=await base.photos.loadPhotos(userId,now);return {...result,photos:result.photos.map(photo=>({...photo,blob:new Blob([photo.name],{type:'image/jpeg'})}))};}};
 const rt:ToolboxRuntime={appId:'events',storage:{...base,photos:photoStore},client};
 const {map,named}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 const {createObjectURL,revokeObjectURL}=URL;let n=0;URL.createObjectURL=()=>`blob:test/${++n}`;URL.revokeObjectURL=()=>{};
 const markers=()=>[...document.querySelectorAll('button[aria-label^="ดูภาพ "]')].map(button=>button.getAttribute('aria-label'));
 const field=(selector:string,value:string)=>act(()=>{const input=document.querySelector(selector) as HTMLInputElement|HTMLTextAreaElement;Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 const choose=async(selector:string,...files:File[])=>{await act(async()=>{const input=document.querySelector(selector) as HTMLInputElement;Object.defineProperty(input,'files',{value:files,configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,50));});};
 try{
  await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u8',accessLevel:'MEMBER'},map,plugins:[photoTool()]},h(ToolboxPanel),h(ToolOverlays),h(ToolDialogs)));
  click('#toolbox-my-photos-settings');
  assert.equal([...document.querySelectorAll('button')].some(button=>button.textContent==='Add to My Photos'),false,'no Add to My Photos step');
  const submit=()=>act(async()=>{(document.querySelector('#photo-event-name')!.closest('form')!.querySelector('button:not([type=button])') as HTMLButtonElement).click();});
  await choose('#toolbox-photo',gpsJpeg('a.jpg',100,13),new File(['x'],'no-gps.jpg',{type:'image/jpeg'}));
  assert.match(document.body.textContent??'',/มีพิกัด 1 รูป · ไม่มีพิกัดหรืออ่านไม่ได้ 1 รูป/);
  await submit();await settle();
  assert.match(document.body.textContent??'',/กรุณาระบุชื่อเหตุการณ์/,'the event name is required');
  assert.deepEqual(Object.values(await rt.storage.photos.loadPhotos('u8')).map(value=>Array.isArray(value)?value.length:value),[0,0,0],'nothing is stored before the set is saved');
  field('#photo-event-name','น้ำท่วมสะพาน');field('#photo-event-tags','flood, เฝ้าระวัง');field('#toolbox-photo-caption-0',' ตลิ่งพัง ');
  await submit();await settle();
  assert.match(document.body.textContent??'',/บันทึกชุด "น้ำท่วมสะพาน" บนเครื่องแล้ว/);
  const stored=await rt.storage.photos.loadPhotos('u8');
  assert.deepEqual(stored.events.map(event=>[event.name,event.tags,event.photoIds.length,event.onMap]),[['น้ำท่วมสะพาน',['flood','เฝ้าระวัง'],1,false]],'only the photo with GPS joins the set');
  assert.deepEqual(stored.photos.map(photo=>[photo.name,photo.latitude,photo.caption]),[['a.jpg',13,'ตลิ่งพัง']]);
  assert.equal(document.querySelectorAll('img[alt^="ภาพตัวอย่าง"]').length,0,'the form is cleared after saving');
  assert.deepEqual(markers(),[],'a saved set is not on the map before Add to map');
  await act(async()=>{(document.querySelector('[aria-label="Add to map ชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
  assert.deepEqual(markers(),['ดูภาพ a.jpg']);
  assert.deepEqual(named('fitBounds').at(-1),['fitBounds',[[100,13],[100,13]]]);
  const eventLayers=()=>registry.getSnapshot().layers.filter(layer=>layer.id.startsWith('my-photos/')).map(layer=>layer.title);
  assert.deepEqual(eventLayers(),['My Photos/น้ำท่วมสะพาน'],'the set becomes its own layer');
  const layerId=registry.getSnapshot().layers.find(layer=>layer.title==='My Photos/น้ำท่วมสะพาน')!.id;
  act(()=>registry.setVisible(layerId,false));
  assert.deepEqual(markers(),[],'hiding the layer hides its markers');
  await act(async()=>{(document.querySelector('[aria-label="Add to map ชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
  assert.equal(registry.getSnapshot().visible[layerId],true,'Add to map shows a hidden set again');
  await act(async()=>{(document.querySelector('[aria-label="Remove from map ชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
  assert.deepEqual([eventLayers(),markers()],[[],[]],'Remove from map drops the layer');
  assert.equal(document.querySelector('[aria-label="Remove from map ชุด น้ำท่วมสะพาน"]'),null,'shown only while the set is on the map');
  assert.equal((await rt.storage.photos.loadPhotos('u8')).photos.length,1,'the set keeps its photos');
  await act(async()=>{(document.querySelector('[aria-label="Add to map ชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
  assert.deepEqual(eventLayers(),['My Photos/น้ำท่วมสะพาน']);
  // The set editor adds new files and removes photos; a photo left in no set is deleted.
  const eventId=layerId.slice('my-photos/'.length),editor='form[aria-label="จัดการชุดรูปเหตุการณ์ น้ำท่วมสะพาน"]';
  click('[aria-label="จัดการชุดรูปเหตุการณ์ น้ำท่วมสะพาน"]');
  await choose(`#toolbox-photo-${eventId}`,gpsJpeg('b.jpg',101,14));
  field(`#toolbox-photo-${eventId}-caption-0`,' น้ำล้นสะพาน ');
  await act(async()=>{(document.querySelector(`${editor} button:not([type=button])`) as HTMLButtonElement).click();});await settle();
  assert.deepEqual(markers().sort(),['ดูภาพ a.jpg','ดูภาพ b.jpg'],'an added photo appears on the map');
  click('[aria-label="จัดการชุดรูปเหตุการณ์ น้ำท่วมสะพาน"]');
  act(()=>([...document.querySelectorAll(`${editor} label`)].find(label=>label.textContent==='a.jpg')!.querySelector('input') as HTMLInputElement).click());
  await act(async()=>{(document.querySelector(`${editor} button:not([type=button])`) as HTMLButtonElement).click();});await settle();
  assert.deepEqual(markers(),['ดูภาพ b.jpg'],'a removed photo leaves the map');
  // Managing a set also renames it and changes its tags; its layer keeps its place and visibility under the new title.
  act(()=>registry.setOpacity(layerId,.5));
  click('[aria-label="จัดการชุดรูปเหตุการณ์ น้ำท่วมสะพาน"]');
  field(`#photo-event-name-${eventId}`,'น้ำท่วมสะพานหลัก');field(`#photo-event-tags-${eventId}`,'flood, สะพาน');
  await act(async()=>{(document.querySelector('form[aria-label="จัดการชุดรูปเหตุการณ์ น้ำท่วมสะพาน"] button:not([type=button])') as HTMLButtonElement).click();});await settle();
  assert.deepEqual((await rt.storage.photos.loadPhotos('u8')).events.map(event=>[event.name,event.tags]),[['น้ำท่วมสะพานหลัก',['flood','สะพาน']]]);
  assert.deepEqual(eventLayers(),['My Photos/น้ำท่วมสะพานหลัก']);
  assert.deepEqual([registry.getSnapshot().visible[layerId],registry.getSnapshot().opacity[layerId]],[true,.5]);
  click('[aria-label="จัดการชุดรูปเหตุการณ์ น้ำท่วมสะพานหลัก"]');field(`#photo-event-name-${eventId}`,'น้ำท่วมสะพาน');field(`#photo-event-tags-${eventId}`,'flood, เฝ้าระวัง');
  await act(async()=>{(document.querySelector('form[aria-label="จัดการชุดรูปเหตุการณ์ น้ำท่วมสะพานหลัก"] button:not([type=button])') as HTMLButtonElement).click();});await settle();
  assert.deepEqual((await rt.storage.photos.loadPhotos('u8')).photos.map(photo=>[photo.name,photo.caption]),[['b.jpg','น้ำล้นสะพาน']],'the removed photo is deleted; the new one keeps its caption');
  click('[aria-label="ดูภาพ b.jpg"]');
  assert.match(document.body.textContent??'',/น้ำล้นสะพาน/,'the map popup shows the caption');
  await act(async()=>{(document.querySelector('[aria-label="Save to Public ชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
  assert.equal(posted.length,1);
  assert.equal(posted[0].get('captions'),'["น้ำล้นสะพาน"]');
  assert.deepEqual([posted[0].get('eventName'),posted[0].get('tags'),posted[0].getAll('photos').length],['น้ำท่วมสะพาน','["flood","เฝ้าระวัง"]',1]);
  assert.match(document.body.textContent??'',/Save to Public แล้ว · share2026-10-27, flood/);
  assert.equal(document.querySelector('[aria-label="Save to Public ชุด น้ำท่วมสะพาน"]'),null,'a saved set is not uploaded twice');
  // A second set gets its own layer above the first; deleting sets deletes their photos.
  await choose('#toolbox-photo',gpsJpeg('c.jpg',102,15));
  field('#photo-event-name','ตลิ่งพัง');await submit();await settle();
  await act(async()=>{(document.querySelector('[aria-label="Add to map ชุด ตลิ่งพัง"]') as HTMLButtonElement).click();});await settle();
  assert.deepEqual(eventLayers(),['My Photos/ตลิ่งพัง','My Photos/น้ำท่วมสะพาน']);
  await act(async()=>{(document.querySelector('[aria-label="ลบชุด ตลิ่งพัง"]') as HTMLButtonElement).click();});await settle();
  await act(async()=>{(document.querySelector('[aria-label="ลบชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
  assert.deepEqual(eventLayers(),[],'deleting a set removes its layer');
  const after=await rt.storage.photos.loadPhotos('u8');
  assert.deepEqual([after.events.length,after.photos.length],[0,0],'deleting a set deletes its photos');
 }finally{URL.createObjectURL=createObjectURL;URL.revokeObjectURL=revokeObjectURL}
});
