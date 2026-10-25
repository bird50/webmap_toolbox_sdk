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
 assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.owner?.key]),[['basins',undefined],['my-data-files','files']]);
 assert.match(container.textContent??'',/Layer My Data Files \(1\)/);
 const last=named('set').at(-1)!;
 assert.equal(last[1],'my-data-files');assert.equal((last[2] as {features:unknown[]}).features.length,1);
 assert.deepEqual(last[3],{kind:'mixed',color:'#f59e0b',opacity:1,minZoom:0,maxZoom:24});
 assert.deepEqual(named('setVisible').at(-1),['setVisible','my-data-files',false]);
 assert.deepEqual(named('order').at(-1),['order',['basins','my-data-files']]);
 click('#my-data-files-visible');
 assert.equal(registry.getSnapshot().visible['my-data-files'],true);
 assert.deepEqual(named('setVisible').at(-1),['setVisible','my-data-files',true]);
 act(()=>registry.setOpacity('my-data-files',.4));
 assert.equal((named('set').at(-1)![3] as {opacity:number}).opacity,.4);
 act(()=>root.unmount());root=createRoot(container);
 assert.deepEqual(named('remove').at(-1),['remove','my-data-files']);
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
 await rt.storage.photos.savePhotos('u6',[{file:new File(['x'],'river.jpg',{type:'image/jpeg'}),longitude:100,latitude:13}]);
 const {createObjectURL,revokeObjectURL}=URL;URL.createObjectURL=()=>'blob:test/river';URL.revokeObjectURL=()=>{};
 try{
  await render(h(ui.ToolboxProvider,{runtime:rt,registry,user:{id:'u6',accessLevel:'MEMBER'},map,plugins:[photoTool()]},h(ToolOverlays)));
  const marker=document.querySelector('button[aria-label="ดูภาพ river.jpg"]') as HTMLButtonElement;
  assert.ok(marker);assert.equal(marker.style.left,'100px');assert.equal(marker.style.top,'100px');
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
