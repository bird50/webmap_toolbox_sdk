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

test('data files: restores sets on the map as their own layers, draws them through the GeoJSON surface and follows the registry',async()=>{
 const rt=runtime(),{map,named}=fakeMap();
 const point={type:'FeatureCollection' as const,features:[{type:'Feature' as const,properties:{name:'a'},geometry:{type:'Point' as const,coordinates:[100,13]}}]};
 await rt.storage.files('u1',{add:{id:'f1',name:'stations',description:'',onMap:true,data:point}});
 await rt.storage.files('u1',{add:{id:'f2',name:'off map',description:'',data:point}});
 const registry=createLayerRegistry([layer('basins')],'MEMBER');
 function HostRemove({layerId}:{layerId:string}){const remove=ui.useLayerRemove(layerId);return remove?h('button',{id:'host-remove',onClick:remove},'−'):null;}
 await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u1',accessLevel:'MEMBER'},map,plugins:[dataFilesTool()]},h(ToolboxPanel),h(ToolOverlays),h(ToolDialogs),h(HostRemove,{layerId:'my-data-files/f1'})));
 assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.title,l.owner?.key]),[['my-data-files/f1','My Data Files/stations','file'],['basins','basins',undefined]],'only sets on the map get a layer, above host layers');
 const setOf=(id:string)=>named('set').filter(call=>call[1]===id).at(-1)!,visibleOf=(id:string)=>named('setVisible').filter(call=>call[1]===id).at(-1);
 assert.match(container.textContent??'',/My Data Files \(ชุดบนแผนที่ 1 · ชุด 2\)/);
 assert.equal(document.querySelector('#my-data-files-visible'),null,'no layer switch in the Toolbox');
 const last=setOf('my-data-files/f1');
 assert.equal((last[2] as {features:{properties:Record<string,unknown>}[]}).features[0].properties.data_file,'stations');
 assert.deepEqual(last[3],{kind:'mixed',color:'#f59e0b',opacity:1,minZoom:0,maxZoom:24});
 assert.deepEqual(visibleOf('my-data-files/f1'),['setVisible','my-data-files/f1',true]);
 assert.deepEqual(named('order').at(-1),['order',['my-data-files/f1','basins']]);
 act(()=>registry.setVisible('my-data-files/f1',false));
 assert.deepEqual(visibleOf('my-data-files/f1'),['setVisible','my-data-files/f1',false]);
 act(()=>registry.setOpacity('my-data-files/f1',.4));
 assert.equal((setOf('my-data-files/f1')[3] as {opacity:number}).opacity,.4);
 click('#host-remove');await settle();
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins'],'the host − button takes the set off the map');
 assert.ok(named('remove').some(call=>call[1]==='my-data-files/f1'));
 assert.equal((await rt.storage.files('u1')).find(file=>file.id==='f1')?.onMap,false,'the set stays, off the map');
});
test('tool dialogs are exclusive across tools and reachable from a host Layer Panel through layerSettings',async()=>{
 const {map}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 function HostSettings({layerId}:{layerId:string}){const settings=ui.useLayerSettings(layerId);return settings?h('button',{id:`settings-${layerId}`,'aria-expanded':settings.open,onClick:(event:{currentTarget:HTMLElement})=>settings.show(event.currentTarget)},'⚙'):h('span',{id:`none-${layerId}`});}
 const photo=createPhotoTool(()=>null,[]),rt=runtime();
 await rt.storage.files('u2',{add:{id:'f1',name:'a',description:'',onMap:true,data:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[100,13]}}]}}});
 await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u2',accessLevel:'MEMBER'},map,plugins:[dataFilesTool(),photo]},h(HostSettings,{layerId:'my-data-files/f1'}),h(HostSettings,{layerId:'basins'}),h(ToolboxPanel),h(ToolDialogs)));
 assert.ok(document.querySelector('#none-basins'),'layers without declared settings get no button');
 click('#toolbox-public-photos-settings');
 assert.equal(document.querySelector('#toolbox-public-photos-settings')?.getAttribute('aria-expanded'),'true');
 click('#toolbox-data-files-settings');
 assert.equal(document.querySelector('#toolbox-public-photos-settings')?.getAttribute('aria-expanded'),'false');
 assert.equal(document.querySelector('#settings-my-data-files\\/f1')?.getAttribute('aria-expanded'),'true');
 click('#toolbox-my-photos-settings');
 assert.equal(document.querySelector('#toolbox-data-files-settings')?.getAttribute('aria-expanded'),'false');
 assert.equal(document.querySelector('#toolbox-my-photos-settings')?.getAttribute('aria-expanded'),'true');
});
test('draw: the draft is saved as a named set with its own layer; sets are managed, saved to Public and found by search',async()=>{
 const {map,named}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 const shareId='33333333-3333-4333-8333-333333333333';
 const point=(text:string,x:number)=>({id:crypto.randomUUID(),tool:'point' as const,points:[[x,13] as [number,number]],text,style:{color:'#dc2626',background:'#ffffff',border:'#64748b',font:'sans-serif' as const,fontSize:18,width:3,opacity:1,rotation:0,alignment:'left' as const},boxWidth:200,boxHeight:100});
 const posted:unknown[]=[];
 const client=createPublicClient({fetch:async(url,init)=>{const path=String(url);
  if(path==='/api/drawing-shares'&&init?.method==='POST'){posted.push(JSON.parse(String(init.body)));return Response.json({id:shareId,count:1,tags:['share2026-10-27','flood']},{status:201});}
  if(path.startsWith('/api/public/drawing-shares'))return Response.json({sets:[{id:shareId,name:'คันกั้นน้ำ Public',tags:['share2026-10-27'],username:'anonymous',appName:'ThaiWater GIS',createdAt:Date.now(),drawingCount:1,bbox:[101,13,101,13]}],hasMore:false});
  if(path===`/api/drawing-shares/${shareId}`)return Response.json({id:shareId,name:'คันกั้นน้ำ Public',tags:[],username:'anonymous',appName:'ThaiWater GIS',createdAt:1,drawings:[point('public',101)]});
  return Response.json({},{status:404});}});
 const rt:ToolboxRuntime={appId:'draw',storage:createBrowserStorage(`draw-${++counter}`),client};
 await rt.storage.drawings('u3',[point('แนวคัน',100)]);
 localStorage.clear();
 function HostProbe(){const [open]=useDrawingToolbar();return h('output',{id:'host-toolbar'},String(open));}
 function HostRemove({layerId}:{layerId:string}){const remove=ui.useLayerRemove(layerId);return remove?h('button',{id:'host-remove',onClick:remove},'−'):null;}
 const titles=()=>registry.getSnapshot().layers.map(layer=>layer.title);
 const field=(selector:string,value:string)=>act(()=>{const input=document.querySelector(selector) as HTMLInputElement;Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 const press=(label:string)=>act(async()=>{(document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click();});
 let layerId='';
 const view=()=>h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u3',accessLevel:'MEMBER'},map,plugins:[drawTool()]},h(HostProbe),h(ToolboxPanel),h(ToolOverlays),h(ToolDialogs),h(DataPanel),layerId?h(HostRemove,{layerId}):null);
 await render(view());
 assert.deepEqual(titles(),[],'no static Draw layers');
 assert.equal(document.querySelector('#toolbox-my-drawing'),null,'no per-layer switches');
 click('#drawing-toolbar-toggle');await settle();
 assert.ok(document.querySelector('#drawing-toolbar'));
 assert.equal(document.querySelector('#host-toolbar')?.textContent,'true');
 assert.match(container.textContent??'',/กระดาษร่าง 1 วัตถุ/,'the draft from this browser is on the canvas');
 const save=()=>act(async()=>{(document.querySelector('#drawing-set-name')!.closest('form')!.querySelector('button:not([type=button])') as HTMLButtonElement).click();});
 await save();await settle();
 assert.match(document.body.textContent??'',/กรุณาระบุชื่อชุดรูปวาด/,'the set name is required');
 field('#drawing-set-name','แนวคันกั้นน้ำ');field('#drawing-set-tags','flood, คันดิน');
 await save();await settle();
 assert.deepEqual(titles(),['My Drawing/แนวคันกั้นน้ำ'],'the saved set becomes its own layer');
 layerId=registry.getSnapshot().layers[0].id;
 assert.equal(registry.getSnapshot().layers[0].owner?.key,'mine');
 assert.match(container.textContent??'',/กระดาษร่าง 0 วัตถุ/,'the draft is cleared');
 const sets=await rt.storage.drawings.loadSets('u3');
 assert.deepEqual(sets.map(set=>[set.name,set.tags,set.drawings.length,set.onMap]),[['แนวคันกั้นน้ำ',['flood','คันดิน'],1,true]]);
 assert.deepEqual((await rt.storage.drawings('u3')).drawings,[],'the stored draft is empty');
 // Data Panel row: the object's type zooms to it.
 const tabs=()=>[...document.querySelectorAll('[role=tab]')].map(tab=>tab.textContent);
 assert.ok(tabs().some(tab=>tab?.startsWith('My Drawing/แนวคันกั้นน้ำ')));
 assert.deepEqual([...document.querySelectorAll('th')].map(th=>th.textContent),['ประเภท','ข้อความ','ชุดรูปวาด']);
 click('[aria-label="ดู จุด บนแผนที่"]');
 assert.deepEqual(named('navigate').at(-1),['navigate',{longitude:100,latitude:13,zoom:16}]);
 // Manage the set in the My Drawing dialog.
 click('#toolbox-my-drawing-settings');
 await press('Remove from map ชุด แนวคันกั้นน้ำ');await settle();
 assert.deepEqual(titles(),[],'Remove from map drops the layer');
 await press('Add to map ชุด แนวคันกั้นน้ำ');await settle();
 assert.deepEqual(titles(),['My Drawing/แนวคันกั้นน้ำ']);
 click('[aria-label="จัดการชุดรูปวาด แนวคันกั้นน้ำ"]');
 const setId=sets[0].id;
 field(`#drawing-set-name-${setId}`,'แนวคันหลัก');
 await act(async()=>{(document.querySelector('form[aria-label="จัดการชุดรูปวาด แนวคันกั้นน้ำ"] button:not([type=button])') as HTMLButtonElement).click();});await settle();
 assert.deepEqual(titles(),['My Drawing/แนวคันหลัก'],'renaming retitles the layer');
 await press('Save to Public ชุด แนวคันหลัก');await settle();
 assert.deepEqual(posted.map(body=>{const b=body as {name:string;tags:string[];drawings:unknown[]};return [b.name,b.tags,b.drawings.length];}),[['แนวคันหลัก',['flood','คันดิน'],1]]);
 assert.equal(document.querySelector('[aria-label="Save to Public ชุด แนวคันหลัก"]'),null,'a saved set is not uploaded twice');
 // Reopen the set on the canvas, then save the edit.
 click('[aria-label="จัดการชุดรูปวาด แนวคันหลัก"]');
 click('[aria-label="แก้ไขรูปวาดของชุด แนวคันหลัก ใน Drawing Toolbar"]');await settle();
 assert.match(document.body.textContent??'',/กำลังแก้ไขชุด "แนวคันหลัก"/);
 await act(async()=>{([...document.querySelectorAll('#drawing-toolbar button')].find(button=>button.textContent?.includes('บันทึกการแก้ไข')) as HTMLButtonElement).click();});await settle();
 assert.equal((await rt.storage.drawings.loadSets('u3'))[0].drawings.length,1);
 // The host − button takes the set off the map.
 act(()=>root.render(view()));await settle();
 click('#host-remove');await settle();
 assert.deepEqual(titles(),[]);
 assert.equal((await rt.storage.drawings.loadSets('u3'))[0].onMap,false,'the set stays, off the map');
 // Public search: sets first, Add to map makes "Public Drawing/<name>", remembered in the browser.
 click('#toolbox-public-drawing-settings');await settle();
 assert.deepEqual([...document.querySelectorAll('article[aria-label="คันกั้นน้ำ Public"]')].length,1);
 assert.deepEqual(titles(),[],'searching adds nothing to the map');
 await press('Add to map ชุด คันกั้นน้ำ Public');await settle();
 assert.deepEqual(titles(),['Public Drawing/คันกั้นน้ำ Public']);
 assert.deepEqual(JSON.parse(localStorage.getItem('toolbox:draw:toolbox.draw:public-drawing-sets:u3')!),[{id:shareId,name:'คันกั้นน้ำ Public'}]);
 await press('Remove from map ชุด คันกั้นน้ำ Public');await settle();
 assert.deepEqual(titles(),[]);
 // Deleting the set removes it.
 click('#toolbox-my-drawing-settings');
 await press('ลบชุด แนวคันหลัก');await settle();
 assert.deepEqual(await rt.storage.drawings.loadSets('u3'),[]);
});
test('photo: the controller restores My Photos with object URLs and revokes them on unmount',async()=>{
 const rt=runtime(),{map}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 await rt.storage.photos.savePhotos('u4',[{file:new File(['x'],'a.jpg',{type:'image/jpeg'}),longitude:100,latitude:13}]);
 const created:string[]=[],revoked:string[]=[];
 const {createObjectURL,revokeObjectURL}=URL;
 URL.createObjectURL=()=>{const url=`blob:test/${created.length}`;created.push(url);return url;};URL.revokeObjectURL=url=>{revoked.push(url);};
 try{
  await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u4',accessLevel:'MEMBER'},map,plugins:[createPhotoTool(()=>null,[])]},h(ToolboxPanel)));
  assert.match(container.textContent??'',/My Photos \(ชุดบนแผนที่ 0 · รูป 1\)/);
  assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.visible]),[],'no photo layer until a set is added to the map');
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
 assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.title,l.owner?.key]),[],'Draw creates layers per set at runtime');
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
 assert.match(container.textContent??'',/My Data Files \(ชุดบนแผนที่ 0 · ชุด 0\)/);
});
test('tool entries work without configured storage: each tool opens its own default database',async()=>{
 const {dataFilesTool:filesFromEntry}=await import('../src/tools/data-files.js');
 const {createDataFileStorage}=await import('../src/storage/data-file-storage.js');
 await createDataFileStorage('toolbox:entry-only:files:v1')('u8',{add:{name:'a.geojson',description:'',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[100,13]}}]}}});
 const {map}=fakeMap();
 const bare={appId:'entry-only',client:createPublicClient()} as ToolboxRuntime;
 await render(h(ui.ToolboxProvider,{runtime:bare,registry:createLayerRegistry([],'MEMBER'),user:{id:'u8',accessLevel:'MEMBER'},map,plugins:[filesFromEntry()]},h(ToolboxPanel)));
 assert.match(container.textContent??'',/My Data Files \(ชุดบนแผนที่ 0 · ชุด 1\)/);
});
test('data panel: lists sources of visible layers, searches, locates rows and summarises a column',async()=>{
 const rt=runtime(),{map,named}=fakeMap();
 await rt.storage.files('u9',{add:{id:'g',name:'gauges.csv',description:'',onMap:true,data:{type:'FeatureCollection',features:[{type:'Feature',properties:{name:'g1',level:'1.5'},geometry:{type:'Point',coordinates:[100,13]}},{type:'Feature',properties:{name:'g2',level:'3.5'},geometry:{type:'Point',coordinates:[101,14]}}]}}});
 const registry=createLayerRegistry([layer('basins',{title:'Basins'}),layer('hidden',{visible:false})],'MEMBER');
 const basins=[{type:'Feature' as const,properties:{name:'Ping',area:10},geometry:{type:'Polygon' as const,coordinates:[[[98,18],[99,18],[99,19],[98,18]]]}}];
 function HostSources(){
  ui.useDataSource({id:'basins',title:'Basins',layerId:'basins',features:basins,labels:{name:'ชื่อ'}});
  ui.useDataSource({id:'hidden',title:'Hidden',layerId:'hidden',features:basins});
  return null;
 }
 await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u9',accessLevel:'MEMBER'},map,plugins:[dataFilesTool()],toolLayers:'start'},h(HostSources),h(DataPanel)));
 act(()=>registry.setVisible('my-data-files/g',false));
 const tabs=()=>[...document.querySelectorAll('[role=tab]')].map(tab=>tab.textContent);
 assert.deepEqual(tabs(),['Basins1'],'only visible layers');
 assert.ok([...document.querySelectorAll('th')].some(th=>th.textContent==='ชื่อ'),'labels become headers');
 click('[aria-label="ดู Ping บนแผนที่"]');
 assert.deepEqual(named('fitBounds').at(-1),['fitBounds',[[98,18],[99,19]]]);
 act(()=>registry.setVisible('my-data-files/g',true));
 assert.deepEqual(tabs(),['My Data Files/gauges.csv2','Basins1'],'tool layers first, like the registry');
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
test('data files: a file is saved as a named set with its own layer; sets are managed, saved to Public and found by search',async()=>{
 const shareId='44444444-4444-4444-8444-444444444444';
 const posted:{name:string;description:string;tags:string[];data:{features:{properties:Record<string,unknown>}[]}}[]=[];
 const requests:string[]=[];
 const client=createPublicClient({fetch:async(url,init)=>{const path=String(url);requests.push(path);
  if(path==='/api/data-file-shares'&&init?.method==='POST'){posted.push(JSON.parse(String(init.body)));return Response.json({id:shareId,count:2,tags:['share2026-10-27','survey']},{status:201});}
  if(path.startsWith('/api/public/data-file-shares'))return Response.json({sets:[{id:shareId,name:'จุดวัด Public',description:'ระดับน้ำ',tags:['share2026-10-27'],username:'anonymous',appName:'ThaiWater GIS',createdAt:Date.now(),featureCount:1,bbox:[101,14,101,14]}],hasMore:false});
  if(path===`/api/data-file-shares/${shareId}`)return Response.json({id:shareId,name:'จุดวัด Public',description:'ระดับน้ำ',tags:['share2026-10-27'],username:'anonymous',appName:'ThaiWater GIS',createdAt:1,data:{type:'FeatureCollection',features:[{type:'Feature',properties:{name:'p1'},geometry:{type:'Point',coordinates:[101,14]}}]}});
  return Response.json({},{status:404});}});
 const rt:ToolboxRuntime={appId:'files',storage:createBrowserStorage(`files-${++counter}`),client};
 localStorage.clear();
 const {map,named}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 const titles=()=>registry.getSnapshot().layers.map(layer=>layer.title);
 const field=(selector:string,value:string)=>act(()=>{const input=document.querySelector(selector) as HTMLInputElement;Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 const choose=(selector:string,file:File)=>act(()=>{const input=document.querySelector(selector) as HTMLInputElement;Object.defineProperty(input,'files',{value:[file],configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}));});
 const press=(label:string)=>act(async()=>{(document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click();});
 const submit=(selector:string)=>act(async()=>{(document.querySelector(selector)!.closest('form')!.querySelector('button:not([type=button])') as HTMLButtonElement).click();});
 await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u7',accessLevel:'MEMBER'},map,plugins:[dataFilesTool()]},h(ToolboxPanel),h(ToolOverlays),h(ToolDialogs),h(DataPanel)));
 assert.deepEqual(titles(),[],'no static Data Files layers');
 assert.equal(requests.length,0,'nothing is fetched before a search');
 click('#toolbox-data-files-settings');await settle();
 await submit('#data-file-name');await settle();
 assert.match(document.body.textContent??'',/กรุณาเลือกไฟล์/,'a file is required');
 choose('#data-file-input',new File(['name,lat,lon,level\ng1,13,100,1.5\ng2,14,101,3.5\n'],'gauges.csv',{type:'text/csv'}));
 assert.equal((document.querySelector('#data-file-name') as HTMLInputElement).value,'gauges','the set is named after the file');
 field('#data-file-name','');
 await submit('#data-file-name');await settle();
 assert.match(document.body.textContent??'',/กรุณาระบุชื่อชุดข้อมูล/,'the set name is required');
 field('#data-file-name','จุดวัดระดับน้ำ');field('#data-file-description','สำรวจเดือนตุลาคม');field('#data-file-tags','survey, ระดับน้ำ');
 await submit('#data-file-name');await settle();
 assert.deepEqual(titles(),['My Data Files/จุดวัดระดับน้ำ'],'the saved set becomes its own layer');
 assert.deepEqual(named('fitBounds').at(-1),['fitBounds',[[100,13],[101,14]]],'the map zooms to the new set');
 const [stored]=await rt.storage.files('u7');
 assert.deepEqual([stored.name,stored.description,stored.tags,stored.onMap,stored.data.features.length],['จุดวัดระดับน้ำ','สำรวจเดือนตุลาคม',['survey','ระดับน้ำ'],true,2]);
 // Data Panel rows carry the set name; headers come from the tool's labels.
 const tabs=()=>[...document.querySelectorAll('[role=tab]')].map(tab=>tab.textContent);
 assert.ok(tabs().some(tab=>tab?.startsWith('My Data Files/จุดวัดระดับน้ำ')));
 assert.deepEqual([...document.querySelectorAll('th')].map(th=>th.textContent).slice(0,3),['ชุดข้อมูล','คำอธิบายชุด','ชื่อ']);
 // Manage the set.
 await press('Remove from map ชุด จุดวัดระดับน้ำ');await settle();
 assert.deepEqual(titles(),[],'Remove from map drops the layer');
 await press('Add to map ชุด จุดวัดระดับน้ำ');await settle();
 assert.deepEqual(titles(),['My Data Files/จุดวัดระดับน้ำ']);
 click('[aria-label="จัดการชุดข้อมูล จุดวัดระดับน้ำ"]');
 field(`#data-file-name-${stored.id}`,'จุดวัดหลัก');
 await submit(`#data-file-name-${stored.id}`);await settle();
 assert.deepEqual(titles(),['My Data Files/จุดวัดหลัก'],'renaming retitles the layer');
 await press('Save to Public ชุด จุดวัดหลัก');await settle();
 assert.deepEqual(posted.map(body=>[body.name,body.description,body.tags,body.data.features.length]),[['จุดวัดหลัก','สำรวจเดือนตุลาคม',['survey','ระดับน้ำ'],2]]);
 assert.equal(posted[0].data.features[0].properties.data_file,undefined,'the stored file is sent, not the layer rows');
 assert.equal(document.querySelector('[aria-label="Save to Public ชุด จุดวัดหลัก"]'),null,'a saved set is not uploaded twice');
 assert.deepEqual((await rt.storage.files('u7'))[0].share?.id,shareId);
 // Public search: sets first, Add to map makes "Public Data Files/<name>", remembered in the browser.
 click('#toolbox-public-data-files-settings');await settle();
 assert.match(requests.find(url=>url.startsWith('/api/public/data-file-shares'))!,/offset=0&limit=20$/);
 assert.equal(document.querySelectorAll('article[aria-label="จุดวัด Public"]').length,1);
 await press('Add to map ชุด จุดวัด Public');await settle();
 assert.deepEqual(titles(),['My Data Files/จุดวัดหลัก','Public Data Files/จุดวัด Public']);
 const drawn=named('set').filter(call=>call[1]===`public-data-files/${shareId}`).at(-1)!;
 assert.equal((drawn[2] as {features:{properties:Record<string,unknown>}[]}).features[0].properties.share_name,'จุดวัด Public');
 assert.deepEqual(JSON.parse(localStorage.getItem('toolbox:files:toolbox.data-files:public-data-file-sets:u7')!),[{id:shareId,name:'จุดวัด Public'}]);
 await press('Remove from map ชุด จุดวัด Public');await settle();
 assert.deepEqual(titles(),['My Data Files/จุดวัดหลัก']);
 // Deleting the set removes it and its layer.
 click('#toolbox-data-files-settings');
 await press('ลบชุด จุดวัดหลัก');await settle();
 assert.deepEqual(await rt.storage.files('u7'),[]);
 assert.deepEqual(titles(),[]);
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
 const {photoTool}=await import('../src/ui/plugins/photo.js');
 const posted:FormData[]=[];
 const client=createPublicClient({fetch:async(url,init)=>{if(String(url)==='/api/photo-shares'){posted.push(init?.body as FormData);return Response.json({id:'s1',url:'/share/s1',tags:['share2026-10-27','flood']},{status:201});}return Response.json({photos:[],hasMore:false});}});
 // fake-indexeddb clones happy-dom Files into plain objects; give the uploader real Blobs, as a browser's IndexedDB does.
 const base=createBrowserStorage(`events-${++counter}`);
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
test('public photo sets: search lists sets first, Add to map makes one layer per set, remembered in the browser',async()=>{
 const {photoTool}=await import('../src/ui/plugins/photo.js');
 const id1='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
 const set=(id:string,eventName:string)=>({id,eventName,tags:['share2026-10-27','flood'],username:'Alice',appName:'ThaiWater GIS',createdAt:1,photoCount:1,capturedFrom:'2026-10-18T09:30:45',capturedTo:'2026-10-18T09:30:45',bbox:[100,13,100,13],url:`/share/${id}`});
 const requests:string[]=[];let removed=false;
 const client=createPublicClient({fetch:async url=>{const path=String(url);requests.push(path);
  if(path.startsWith('/api/public/photo-shares'))return Response.json({sets:[set(id1,'น้ำท่วมสะพาน'),set(id2,'ตลิ่งพัง')],hasMore:false});
  const match=/^\/api\/photo-shares\/([^/?]+)$/.exec(path);
  if(match){if(removed&&match[1]===id2)return Response.json({error:'ไม่พบข้อมูล'},{status:404});const name=match[1]===id1?'น้ำท่วมสะพาน':'ตลิ่งพัง';return Response.json({id:match[1],eventName:name,tags:['flood'],username:'Alice',photos:[{id:`p-${match[1]}`,name:`${name}.jpg`,longitude:100,latitude:13,capturedAt:'2026-10-18T09:30:45',capturedOffset:'+07:00',url:`/api/photo-shares/${match[1]}/photos/p`,caption:'ระดับน้ำสูง'}]});}
  return Response.json({photos:[],hasMore:false});}});
 const rt:ToolboxRuntime={appId:'sets',storage:createBrowserStorage(`sets-${++counter}`),client};
 localStorage.clear();
 const {map,named}=fakeMap(),registry=createLayerRegistry([],'MEMBER');
 const markers=()=>[...document.querySelectorAll('button[aria-label^="ดูภาพ "]')].map(button=>button.getAttribute('aria-label'));
 const titles=()=>registry.getSnapshot().layers.filter(layer=>layer.id.startsWith('public-photos/')).map(layer=>layer.title);
 const view=()=>h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u10',accessLevel:'MEMBER'},map,plugins:[dataFilesTool(),photoTool(),drawTool()]},h(ToolboxPanel),h(ToolOverlays),h(ToolDialogs),h(DataPanel),h(HostRemove,{layerId:`public-photos/${id2}`}),h(HostRemove,{layerId:'my-drawing'}));
 function HostRemove({layerId}:{layerId:string}){const remove=ui.useLayerRemove(layerId);return remove?h('button',{id:`remove-${layerId.replace('/','-')}`,onClick:remove},'−'):null;}
 await render(view());
 assert.equal(document.querySelector('#public-photos-layer'),null,'no Public Photos switch');
 assert.deepEqual(titles(),[]);
 click('#toolbox-public-photos-settings');await settle();
 assert.match(requests.find(url=>url.startsWith('/api/public/photo-shares'))!,/offset=0&limit=20$/,'the newest sets are listed when the search opens');
 assert.deepEqual([...document.querySelectorAll('article[aria-label]')].map(item=>item.getAttribute('aria-label')),['น้ำท่วมสะพาน','ตลิ่งพัง']);
 assert.deepEqual(titles(),[],'searching adds nothing to the map');
 await act(async()=>{(document.querySelector('[aria-label="Add to map ชุด น้ำท่วมสะพาน"]') as HTMLButtonElement).click();});await settle();
 await act(async()=>{(document.querySelector('[aria-label="Add to map ชุด ตลิ่งพัง"]') as HTMLButtonElement).click();});await settle();
 assert.deepEqual(titles(),['Public Photos/ตลิ่งพัง','Public Photos/น้ำท่วมสะพาน'],'one layer per set, newest added on top');
 assert.deepEqual(registry.getSnapshot().layers.map(layer=>layer.owner?.key),['set','set'],'only sets on the map have layers');
 assert.deepEqual(markers().sort(),['ดูภาพ ตลิ่งพัง.jpg','ดูภาพ น้ำท่วมสะพาน.jpg']);
 assert.deepEqual(named('fitBounds').at(-1),['fitBounds',[[100,13],[100,13]]]);
 assert.match(container.textContent??'',/Public Photos \(ชุดบนแผนที่ 2\)/);
 // Each visible photo layer is a Data Panel tab; a photo name zooms to it and opens its popup.
 const tabs=()=>[...document.querySelectorAll('[role=tab]')].map(tab=>tab.textContent);
 assert.ok(tabs().some(tab=>tab?.startsWith('Public Photos/ตลิ่งพัง')),'the photo layer is a Data Panel tab');
 act(()=>([...document.querySelectorAll('[role=tab]')].find(tab=>tab.textContent?.startsWith('Public Photos/น้ำท่วมสะพาน')) as HTMLButtonElement).click());
 assert.deepEqual([...document.querySelectorAll('th')].map(th=>th.textContent).slice(0,4),['ชื่อรูป','ข้อความประกอบ','วันที่ถ่าย','ชุดเหตุการณ์']);
 click('[aria-label="ดู น้ำท่วมสะพาน.jpg บนแผนที่"]');await settle();
 assert.deepEqual(named('navigate').at(-1),['navigate',{longitude:100,latitude:13,zoom:16}],'the map zooms to the photo');
 assert.ok(document.querySelector('[role=dialog][aria-label="น้ำท่วมสะพาน.jpg"]'),'its popup opens');
 act(()=>registry.setVisible(`public-photos/${id1}`,false));
 assert.deepEqual(markers(),['ดูภาพ ตลิ่งพัง.jpg'],'the layer eye hides only its set');
 assert.ok(!tabs().some(tab=>tab?.startsWith('Public Photos/น้ำท่วมสะพาน')),'a hidden layer leaves the Data Panel');
 assert.equal(document.querySelector('#remove-my-drawing'),null,'layers whose tool offers no removal get no − button');
 click(`#remove-public-photos-${id2}`);await settle();
 assert.deepEqual(titles(),['Public Photos/น้ำท่วมสะพาน'],'the host − button takes the set off the map');
 assert.deepEqual(JSON.parse(localStorage.getItem('toolbox:sets:toolbox.photo:public-photo-sets:u10')!).map((item:{eventName:string})=>item.eventName),['น้ำท่วมสะพาน']);
 await act(async()=>{(document.querySelector('[aria-label="Add to map ชุด ตลิ่งพัง"]') as HTMLButtonElement).click();});await settle();
 click('[aria-label="ดูภาพ ตลิ่งพัง.jpg"]');
 assert.match(document.body.textContent??'',/ระดับน้ำสูง/,'the popup shows the set photo and its caption');
 assert.deepEqual(JSON.parse(localStorage.getItem('toolbox:sets:toolbox.photo:public-photo-sets:u10')!).map((item:{eventName:string})=>item.eventName),['ตลิ่งพัง','น้ำท่วมสะพาน']);
 // After a reload the sets come back; one removed from the service leaves the list.
 act(()=>root.unmount());root=createRoot(container);removed=true;
 await render(view());await settle();
 assert.deepEqual(titles(),['Public Photos/น้ำท่วมสะพาน']);
 click('#toolbox-public-photos-settings');await settle();
 click('[aria-label="Remove from map ชุด น้ำท่วมสะพาน"]');await settle();
 assert.deepEqual(titles(),[],'removing a set drops its layer');
 assert.equal(localStorage.getItem('toolbox:sets:toolbox.photo:public-photo-sets:u10'),'[]');
});
