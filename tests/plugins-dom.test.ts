import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {GlobalRegistrator} from '@happy-dom/global-registrator';
import type {LayerDefinition} from '../src/core/layers.js';
import type {MapAdapter,GeoJSONSurface} from '../src/core/map.js';
import type {ToolboxRuntime} from '../src/ui/context.js';

// fake-indexeddb must keep Node's IndexedDB globals; happy-dom only adds the DOM.
GlobalRegistrator.register();
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const {createElement:h,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {createLayerRegistry}=await import('../src/core/registry.js');
const {createPublicClient}=await import('../src/core/client.js');
const {createBrowserStorage}=await import('../src/storage/index.js');
const ui=await import('../src/ui/context.js');
const {ToolboxPanel,ToolOverlays,ToolDialogs}=await import('../src/ui/runtime.js');
const {dataFilesTool}=await import('../src/ui/plugins/data-files.js');
const {drawTool,useDrawingToolbar}=await import('../src/ui/plugins/draw.js');
const {navigationTool}=await import('../src/ui/plugins/navigation.js');
const {createPhotoTool}=await import('../src/ui/plugins/photo.js');
const {DataPanel}=await import('../src/ui/DataPanel.js');

let counter=0;
const runtime=():ToolboxRuntime=>({appId:'plugins',storage:createBrowserStorage(`plugins-${++counter}`),client:createPublicClient({fetch:async()=>Response.json({photos:[],drawings:[],hasMore:false})})});
const layer=(id:string,extra:Partial<LayerDefinition>={}):LayerDefinition=>({id,title:id,description:'',group:'host',type:'GEOJSON',url:'/x',visible:true,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#000',legend:'',popupFields:[],...extra});
type Call=[string,...unknown[]];
function fakeMap(){
 const calls:Call[]=[];const record=(name:string)=>(...args:unknown[])=>{calls.push([name,...args]);};
 const geojson:GeoJSONSurface={set:record('set'),remove:record('remove'),setVisible:record('setVisible'),setOpacity:record('setOpacity'),order:record('order'),layerIds:()=>[]};
 const map:MapAdapter={getSize:()=>({width:800,height:600}),getZoom:()=>5,getBounds:()=>({getWest:()=>99,getSouth:()=>12,getEast:()=>101,getNorth:()=>14}),project:()=>({x:0,y:0}),unproject:()=>({lng:100,lat:13}),navigate:record('navigate'),fitBounds:record('fitBounds'),on(){},off(){},dispose(){},geojson,getContainer:()=>null,onPointer(){},offPointer(){}};
 return {map,calls,named:(name:string)=>calls.filter(call=>call[0]===name)};
}
const settle=()=>act(async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setTimeout(resolve,20));});
let container:HTMLElement,root:ReturnType<typeof createRoot>;
async function render(node:ReturnType<typeof h>){container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(node));await settle();}
const click=(selector:string)=>act(()=>{(document.querySelector(selector) as HTMLElement).click();});
afterEach(()=>{act(()=>root.unmount());container.remove();document.body.innerHTML='';});

test('data files: restores stored files, draws them through the GeoJSON surface and follows the registry',async()=>{
 const rt=runtime(),{map,named}=fakeMap();
 await rt.storage.files('u1',{add:{name:'stations.geojson',description:'',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{name:'a'},geometry:{type:'Point',coordinates:[100,13]}}]}}});
 const registry=createLayerRegistry([layer('basins')],'MEMBER');
 await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u1',accessLevel:'MEMBER'},map,plugins:[dataFilesTool()]},h(ToolboxPanel),h(ToolOverlays),h(ToolDialogs)));
 assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.owner?.key]),[['basins',undefined],['my-data-files','files'],['public-data-files','public']]);
 const setOf=(id:string)=>named('set').filter(call=>call[1]===id).at(-1)!,visibleOf=(id:string)=>named('setVisible').filter(call=>call[1]===id).at(-1);
 assert.match(container.textContent??'',/Layer My Data Files \(1\)/);
 const last=setOf('my-data-files');
 assert.equal(last[1],'my-data-files');assert.equal((last[2] as {features:unknown[]}).features.length,1);
 assert.deepEqual(last[3],{kind:'mixed',color:'#f59e0b',opacity:1,minZoom:0,maxZoom:24});
 assert.deepEqual(visibleOf('my-data-files'),['setVisible','my-data-files',false]);
 assert.deepEqual(named('order').at(-1),['order',['basins','my-data-files','public-data-files']]);
 click('#my-data-files-visible');
 assert.equal(registry.getSnapshot().visible['my-data-files'],true);
 assert.deepEqual(visibleOf('my-data-files'),['setVisible','my-data-files',true]);
 act(()=>registry.setOpacity('my-data-files',.4));
 assert.equal((setOf('my-data-files')[3] as {opacity:number}).opacity,.4);
 act(()=>root.unmount());root=createRoot(container);
 assert.ok(named('remove').some(call=>call[1]==='my-data-files'));
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins']);
});
test('tool dialogs are exclusive across tools and reachable from a host Layer Panel through layerSettings',async()=>{
 const {map}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 function HostSettings({layerId}:{layerId:string}){const settings=ui.useLayerSettings(layerId);return settings?h('button',{id:`settings-${layerId}`,'aria-expanded':settings.open,onClick:(event:{currentTarget:HTMLElement})=>settings.show(event.currentTarget)},'⚙'):h('span',{id:`none-${layerId}`});}
 const photo=createPhotoTool(()=>null,[]);
 await render(h(ui.ToolboxProvider,{runtime:runtime(),registry,user:{id:'u2',accessLevel:'MEMBER'},map,plugins:[dataFilesTool(),photo]},h(HostSettings,{layerId:'public-photos'}),h(HostSettings,{layerId:'my-data-files'}),h(HostSettings,{layerId:'my-photos'}),h(ToolboxPanel),h(ToolDialogs)));
 assert.ok(document.querySelector('#none-my-photos'),'layers without declared settings get no button');
 click('#settings-public-photos');
 assert.equal(document.querySelector('#settings-public-photos')?.getAttribute('aria-expanded'),'true');
 assert.equal(document.querySelector('#toolbox-public-photos-settings')?.getAttribute('aria-expanded'),'true');
 click('#toolbox-data-files-settings');
 assert.equal(document.querySelector('#settings-public-photos')?.getAttribute('aria-expanded'),'false');
 assert.equal(document.querySelector('#settings-my-data-files')?.getAttribute('aria-expanded'),'true');
 click('#toolbox-my-photos-settings');
 assert.equal(document.querySelector('#toolbox-data-files-settings')?.getAttribute('aria-expanded'),'false');
 assert.equal(document.querySelector('#toolbox-my-photos-settings')?.getAttribute('aria-expanded'),'true');
});
test('draw: the toolbar switch opens the overlay toolbar, shows My Drawing and is readable by the host',async()=>{
 const {map}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 function HostProbe(){const [open]=useDrawingToolbar();return h('output',{id:'host-toolbar'},String(open));}
 await render(h(ui.ToolboxProvider,{runtime:runtime(),registry,user:{id:'u3',accessLevel:'MEMBER'},map,plugins:[drawTool()]},h(HostProbe),h(ToolboxPanel),h(ToolOverlays)));
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['my-drawing','public-drawing']);
 assert.equal(document.querySelector('#drawing-toolbar'),null);
 click('#drawing-toolbar-toggle');await settle();
 assert.ok(document.querySelector('#drawing-toolbar'));
 assert.equal(document.querySelector('#host-toolbar')?.textContent,'true');
 assert.equal(registry.getSnapshot().visible['my-drawing'],true);
});
test('photo: the controller restores My Photos with object URLs and revokes them on unmount',async()=>{
 const rt=runtime(),{map}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 await rt.storage.photos.savePhotos('u4',[{file:new File(['x'],'a.jpg',{type:'image/jpeg'}),longitude:100,latitude:13}]);
 const created:string[]=[],revoked:string[]=[];
 const {createObjectURL,revokeObjectURL}=URL;
 URL.createObjectURL=()=>{const url=`blob:test/${created.length}`;created.push(url);return url;};URL.revokeObjectURL=url=>{revoked.push(url);};
 try{
  await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u4',accessLevel:'MEMBER'},map,plugins:[createPhotoTool(()=>null,[])]},h(ToolboxPanel)));
  assert.match(container.textContent??'',/Layer My Photos \(1\)/);
  assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.visible]),[['my-photos',true],['public-photos',false]]);
  act(()=>root.unmount());root=createRoot(container);
  assert.ok(created.length>=1);
  assert.ok(created.every(url=>revoked.includes(url)),'every created URL is revoked');
 }finally{URL.createObjectURL=createObjectURL;URL.revokeObjectURL=revokeObjectURL;}
});
test('layer options rename or drop tool layers; navigation waits for the map',async()=>{
 const registry=createLayerRegistry([],'MEMBER');
 const plugins=[drawTool({mine:{id:'sketch',title:'Sketch'},shared:false}),navigationTool({home:{longitude:98,latitude:18,zoom:8,label:'เชียงใหม่'}})];
 await render(h(ui.ToolboxProvider,{runtime:runtime(),registry,user:{id:'u5',accessLevel:'MEMBER'},plugins,capabilities:['map.navigate']},h(ToolboxPanel)));
 assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.title,l.owner?.key]),[]);
 const {map,named}=fakeMap();
 act(()=>root.render(h(ui.ToolboxProvider,{runtime:runtime(),registry,user:{id:'u5',accessLevel:'MEMBER'},plugins,map},h(ToolboxPanel))));await settle();
 assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.title,l.owner?.key]),[['sketch','Sketch','mine']]);
 const button=[...document.querySelectorAll('button')].find(item=>item.textContent==='เชียงใหม่') as HTMLButtonElement;
 assert.equal(button.disabled,false);act(()=>button.click());
 assert.deepEqual(named('navigate')[0],['navigate',{longitude:98,latitude:18,zoom:8,label:'เชียงใหม่'}]);
});
test('photoTool draws My Photos as HTML markers positioned through MapAdapter.project, with a popup',async()=>{
 const {photoTool}=await import('../src/ui/plugins/photo.js');
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
test('messages override one string per group and keep the rest',async()=>{
 const {dataFilesTool}=await import('../src/ui/plugins/data-files.js');
 const {map}=fakeMap();
 await render(h(ui.ToolboxProvider,{runtime:runtime(),registry:createLayerRegistry([],'MEMBER'),user:{id:'u7',accessLevel:'MEMBER'},map,plugins:[dataFilesTool()],messages:{dataFilesTool:{title:'Data files'}}},h(ToolboxPanel)));
 assert.match(container.textContent??'',/Data files/);
 assert.match(container.textContent??'',/Layer My Data Files \(0\)/);
});
test('tool entries work without configured storage: each tool opens its own default database',async()=>{
 const {dataFilesTool:filesFromEntry}=await import('../src/tools/data-files.js');
 const {createDataFileStorage}=await import('../src/storage/data-file-storage.js');
 await createDataFileStorage('toolbox:entry-only:files:v1')('u8',{add:{name:'a.geojson',description:'',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[100,13]}}]}}});
 const {map}=fakeMap();
 const bare={appId:'entry-only',client:createPublicClient()} as ToolboxRuntime;
 await render(h(ui.ToolboxProvider,{runtime:bare,registry:createLayerRegistry([],'MEMBER'),user:{id:'u8',accessLevel:'MEMBER'},map,plugins:[filesFromEntry()]},h(ToolboxPanel)));
 assert.match(container.textContent??'',/Layer My Data Files \(1\)/);
});
test('data panel: lists sources of visible layers, searches, locates rows and summarises a column',async()=>{
 const rt=runtime(),{map,named}=fakeMap();
 await rt.storage.files('u9',{add:{name:'gauges.csv',description:'',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{name:'g1',level:'1.5'},geometry:{type:'Point',coordinates:[100,13]}},{type:'Feature',properties:{name:'g2',level:'3.5'},geometry:{type:'Point',coordinates:[101,14]}}]}}});
 const registry=createLayerRegistry([layer('basins',{title:'Basins'}),layer('hidden',{visible:false})],'MEMBER');
 const basins=[{type:'Feature' as const,properties:{name:'Ping',area:10},geometry:{type:'Polygon' as const,coordinates:[[[98,18],[99,18],[99,19],[98,18]]]}}];
 function HostSources(){
  ui.useDataSource({id:'basins',title:'Basins',layerId:'basins',features:basins,labels:{name:'ชื่อ'}});
  ui.useDataSource({id:'hidden',title:'Hidden',layerId:'hidden',features:basins});
  return null;
 }
 await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u9',accessLevel:'MEMBER'},map,plugins:[dataFilesTool()],toolLayers:'start'},h(HostSources),h(DataPanel)));
 const tabs=()=>[...document.querySelectorAll('[role=tab]')].map(tab=>tab.textContent);
 assert.deepEqual(tabs(),['Basins1'],'only visible layers; data files layer starts hidden');
 assert.ok([...document.querySelectorAll('th')].some(th=>th.textContent==='ชื่อ'),'labels become headers');
 click('[aria-label="ดู Ping บนแผนที่"]');
 assert.deepEqual(named('fitBounds').at(-1),['fitBounds',[[98,18],[99,19]]]);
 act(()=>registry.setVisible('my-data-files',true));
 assert.deepEqual(tabs(),['My Data Files2','Basins1'],'tool layers first, like the registry');
 click('[role=tab]');
 assert.equal(document.querySelectorAll('tbody tr').length,2);
 const search=document.querySelector('input[type=search]') as HTMLInputElement;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search,'g2');search.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(document.querySelectorAll('tbody tr').length,1);
 click('[aria-label="ดู gauges.csv บนแผนที่"]');
 assert.deepEqual(named('navigate').at(-1),['navigate',{longitude:101,latitude:14,zoom:12}]);
 click('[aria-pressed=false]');
 assert.match(container.textContent??'',/1 ค่า · ต่ำสุด 3.5/,'chart summarises the filtered rows, numeric column first');
});
test('data files: Save & Share Public posts one file with its fields, Public Data Files follows the view and filters',async()=>{
 const requests:{url:string;init?:RequestInit}[]=[];
 const feature={type:'Feature',properties:{name:'g1',level:'1.5',share_name:'จุดวัด',share_tags:'share2026-10-26, survey'},geometry:{type:'Point',coordinates:[100,13]}};
 const client=createPublicClient({fetch:async(url,init)=>{requests.push({url:String(url),init});return String(url).startsWith('/api/data-file-shares')?Response.json({id:'s1',count:1,tags:['share2026-10-26','survey']},{status:201}):Response.json({features:[feature],hasMore:false});}});
 const rt:ToolboxRuntime={appId:'share',storage:createBrowserStorage(`share-${++counter}`),client};
 await rt.storage.files!('u7',{add:{name:'gauges.csv',description:'ระดับน้ำ',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{name:'g1'},geometry:{type:'Point',coordinates:[100,13]}}]}}});
 const {map,named}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u7',accessLevel:'MEMBER'},map,plugins:[dataFilesTool()]},h(ToolboxPanel),h(ToolOverlays),h(ToolDialogs)));
 assert.equal(requests.length,0,'nothing is fetched while Public Data Files is hidden');
 click('#toolbox-data-files-settings');
 click('[aria-label="Share Public: gauges.csv"]');
 const field=(selector:string,value:string)=>act(()=>{const input=document.querySelector(selector) as HTMLInputElement;Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 const form=document.querySelector('form[aria-label="บันทึกเพื่อแชร์ Public"]')!;
 assert.equal((form.querySelector('input') as HTMLInputElement).value,'gauges','name defaults to the file name');
 assert.equal((form.querySelector('textarea') as HTMLTextAreaElement).value,'ระดับน้ำ','description defaults to the file description');
 field('form[aria-label="บันทึกเพื่อแชร์ Public"] input[maxlength="510"]','survey, ระดับน้ำ');
 await act(async()=>{(form.querySelector('button:not([type=button])') as HTMLButtonElement).click();});await settle();
 const posted=requests.find(request=>request.url==='/api/data-file-shares')!;
 assert.equal(posted.init?.method,'POST');
 const body=JSON.parse(String(posted.init?.body));
 assert.deepEqual([body.name,body.description,body.tags,body.data.features.length],['gauges','ระดับน้ำ',['survey','ระดับน้ำ'],1]);
 assert.equal(body.data.features[0].properties.data_file,undefined,'the stored file is sent, not the merged layer rows');
 assert.match(container.ownerDocument.body.textContent??'',/บันทึก Public แล้ว 1 รายการ/);
 // The view loader debounces by 250 ms.
 const debounce=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,300));});
 click('#public-data-files-visible');await debounce();await settle();
 const loaded=requests.filter(request=>request.url.startsWith('/api/public/data-files'));
 assert.match(loaded.at(-1)!.url,/bbox=99%2C12%2C101%2C14&limit=500/);
 const drawn=named('set').filter(call=>call[1]==='public-data-files').at(-1)!;
 assert.equal((drawn[2] as {features:unknown[]}).features.length,1);
 assert.deepEqual(named('setVisible').filter(call=>call[1]==='public-data-files').at(-1),['setVisible','public-data-files',true]);
 assert.match(container.textContent??'',/1 รายการ Public ในพื้นที่นี้/);
 click('#toolbox-public-data-files-settings');
 field('#public-data-files-tag','survey');
 await act(async()=>{(document.querySelector('#public-data-files-tag')!.closest('form')!.querySelector('button:not([type=button])') as HTMLButtonElement).click();});await debounce();await settle();
 assert.match(requests.filter(request=>request.url.startsWith('/api/public/data-files')).at(-1)!.url,/&tag=survey$/);
 assert.match(container.textContent??'',/ใช้เงื่อนไขค้นหา 1 ข้อ/);
});
test('photo events: a named set is saved in the browser, Add to map shows it, photos are added and removed, Save to Public uploads it once',async()=>{
 const {photoTool}=await import('../src/ui/plugins/photo.js');
 const posted:FormData[]=[];
 const client=createPublicClient({fetch:async(url,init)=>{if(String(url)==='/api/photo-shares'){posted.push(init?.body as FormData);return Response.json({id:'s1',url:'/share/s1',tags:['share2026-10-27','flood']},{status:201});}return Response.json({photos:[],hasMore:false});}});
 // fake-indexeddb clones happy-dom Files into plain objects; give the uploader real Blobs, as a browser's IndexedDB does.
 const base=createBrowserStorage(`events-${++counter}`);
 const photoStore={...base.photos,async loadPhotos(userId:string,now?:number){const result=await base.photos.loadPhotos(userId,now);return {...result,photos:result.photos.map(photo=>({...photo,blob:new Blob([photo.name],{type:'image/jpeg'})}))};}};
 const rt:ToolboxRuntime={appId:'events',storage:{...base,photos:photoStore},client};
 await rt.storage.photos.savePhotos('u8',[{file:new File(['a'],'a.jpg',{type:'image/jpeg'}),longitude:100,latitude:13},{file:new File(['b'],'b.jpg',{type:'image/jpeg'}),longitude:101,latitude:14}]);
 const {map,named}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 const {createObjectURL,revokeObjectURL}=URL;let n=0;URL.createObjectURL=()=>`blob:test/${++n}`;URL.revokeObjectURL=()=>{};
 const markers=()=>[...document.querySelectorAll('button[aria-label^="ดูภาพ "]')].map(button=>button.getAttribute('aria-label'));
 const field=(selector:string,value:string)=>act(()=>{const input=document.querySelector(selector) as HTMLInputElement;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 try{
  await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u8',accessLevel:'MEMBER'},map,plugins:[photoTool()]},h(ToolboxPanel),h(ToolOverlays),h(ToolDialogs)));
  assert.deepEqual(markers(),[],'saved photos are not on the map before an event is added');
  click('#toolbox-my-photos-settings');
  const pick=(name:string)=>act(()=>([...document.querySelectorAll('fieldset label')].find(label=>label.textContent?.startsWith(name))!.querySelector('input') as HTMLInputElement).click());
  const submit=()=>act(async()=>{(document.querySelector('#photo-event-name')!.closest('form')!.querySelector('button:not([type=button])') as HTMLButtonElement).click();});
  pick('a.jpg');await submit();await settle();
  assert.match(document.body.textContent??'',/กรุณาระบุชื่อเหตุการณ์/,'the event name is required');
  assert.equal((await rt.storage.photos.loadPhotos('u8')).events.length,0);
  pick('a.jpg');
  field('#photo-event-name','น้ำท่วมสะพาน');field('#photo-event-tags','flood, เฝ้าระวัง');
  pick('a.jpg');await submit();await settle();
  assert.match(document.body.textContent??'',/บันทึกชุด "น้ำท่วมสะพาน" บนเครื่องแล้ว/);
  const stored=await rt.storage.photos.loadPhotos('u8');
  assert.deepEqual(stored.events.map(event=>[event.name,event.tags,event.photoIds.length,event.onMap]),[['น้ำท่วมสะพาน',['flood','เฝ้าระวัง'],1,false]]);
  await act(async()=>{(document.querySelector('[aria-label="แสดงชุด น้ำท่วมสะพาน บนแผนที่"]') as HTMLButtonElement).click();});await settle();
  assert.deepEqual(markers(),['ดูภาพ a.jpg']);
  assert.deepEqual(named('fitBounds').at(-1),['fitBounds',[[100,13],[100,13]]]);
  assert.equal(registry.getSnapshot().visible['my-photos'],true);
  assert.doesNotMatch(document.body.textContent??'',/ซ่อนจากแผนที่/,'no hide button');
  click('[aria-label="เพิ่ม-ลบรูปในชุด น้ำท่วมสะพาน"]');
  const editor='form[aria-label="เพิ่ม-ลบรูปในชุด น้ำท่วมสะพาน"]';
  const toggle=(name:string)=>act(()=>([...document.querySelectorAll(`${editor} label`)].find(label=>label.textContent===name)!.querySelector('input') as HTMLInputElement).click());
  toggle('b.jpg');
  const caption=document.querySelector('textarea[aria-label="ข้อความประกอบรูป b.jpg"]') as HTMLTextAreaElement;
  act(()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(caption,' น้ำล้นสะพาน ');caption.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>{(document.querySelector(`${editor} button:not([type=button])`) as HTMLButtonElement).click();});await settle();
  assert.deepEqual(markers().sort(),['ดูภาพ a.jpg','ดูภาพ b.jpg'],'an added photo appears on the map');
  click('[aria-label="เพิ่ม-ลบรูปในชุด น้ำท่วมสะพาน"]');toggle('a.jpg');
  await act(async()=>{(document.querySelector(`${editor} button:not([type=button])`) as HTMLButtonElement).click();});await settle();
  assert.deepEqual(markers(),['ดูภาพ b.jpg'],'a removed photo leaves the map');
  assert.deepEqual((await rt.storage.photos.loadPhotos('u8')).events[0].photoIds.length,1);
  assert.equal((await rt.storage.photos.loadPhotos('u8')).photos.find(photo=>photo.name==='b.jpg')?.caption,'น้ำล้นสะพาน','the caption is saved on the photo');
  click('[aria-label="ดูภาพ b.jpg"]');
  assert.match(document.body.textContent??'',/น้ำล้นสะพาน/,'the map popup shows the caption');
  await act(async()=>{(document.querySelector('[aria-label="Save to Public ชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
  assert.equal(posted.length,1);
  assert.equal(posted[0].get('captions'),'["น้ำล้นสะพาน"]');
  assert.deepEqual([posted[0].get('eventName'),posted[0].get('tags'),posted[0].getAll('photos').length],['น้ำท่วมสะพาน','["flood","เฝ้าระวัง"]',1]);
  assert.match(document.body.textContent??'',/Save to Public แล้ว · share2026-10-27, flood/);
  assert.equal(document.querySelector('[aria-label="Save to Public ชุด น้ำท่วมสะพาน"]'),null,'a saved set is not uploaded twice');
  await act(async()=>{(document.querySelector('[aria-label="ลบชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
  const after=await rt.storage.photos.loadPhotos('u8');
  assert.deepEqual([after.events.length,after.photos.length],[0,2],'deleting a set keeps its photos');
 }finally{URL.createObjectURL=createObjectURL;URL.revokeObjectURL=revokeObjectURL}
});
