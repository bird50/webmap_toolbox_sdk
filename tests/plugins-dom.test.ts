import {test} from 'node:test';
import assert from 'node:assert/strict';
import {h,act,createRoot,createLayerRegistry,createPublicClient,createBrowserStorage,ui,ToolboxPanel,ToolOverlays,ToolDialogs,DataPanel,nextId,runtime,layer,fakeMap,settle,dom,render,click} from './helpers/dom.js';
import type {ToolboxRuntime} from '../src/ui/context.js';

const {dataFilesTool}=await import('../src/tools/data-files/plugin.js');
const {drawTool,useDrawingToolbar}=await import('../src/tools/draw/plugin.js');
const {navigationTool}=await import('../src/tools/navigation/plugin.js');
const {createPhotoTool}=await import('../src/tools/photo/plugin.js');

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
test('layer options rename or drop tool layers; navigation waits for the map',async()=>{
 const registry=createLayerRegistry([],'MEMBER');
 const plugins=[drawTool({mine:{id:'sketch',title:'Sketch'},shared:false}),navigationTool({home:{longitude:98,latitude:18,zoom:8,label:'เชียงใหม่'}})];
 await render(h(ui.ToolboxProvider,{runtime:runtime(),registry,user:{id:'u5',accessLevel:'MEMBER'},plugins,capabilities:['map.navigate']},h(ToolboxPanel)));
 assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.title,l.owner?.key]),[]);
 const {map,named}=fakeMap();
 act(()=>dom.root.render(h(ui.ToolboxProvider,{runtime:runtime(),registry,user:{id:'u5',accessLevel:'MEMBER'},plugins,map},h(ToolboxPanel))));await settle();
 assert.deepEqual(registry.getSnapshot().layers.map(l=>[l.id,l.title,l.owner?.key]),[],'Draw creates layers per set at runtime');
 const button=[...document.querySelectorAll('button')].find(item=>item.textContent==='เชียงใหม่') as HTMLButtonElement;
 assert.equal(button.disabled,false);act(()=>button.click());
 assert.deepEqual(named('navigate')[0],['navigate',{longitude:98,latitude:18,zoom:8,label:'เชียงใหม่'}]);
});
test('messages override one string per group and keep the rest',async()=>{
 const {dataFilesTool}=await import('../src/tools/data-files/plugin.js');
 const {map}=fakeMap();
 await render(h(ui.ToolboxProvider,{runtime:runtime(),registry:createLayerRegistry([],'MEMBER'),user:{id:'u7',accessLevel:'MEMBER'},map,plugins:[dataFilesTool()],messages:{dataFilesTool:{title:'Data files'}}},h(ToolboxPanel)));
 assert.match(dom.container.textContent??'',/Data files/);
 assert.match(dom.container.textContent??'',/My Data Files \(ชุดบนแผนที่ 0 · ชุด 0\)/);
});
test('public photo sets: search lists sets first, Add to map makes one layer per set, remembered in the browser',async()=>{
 const {photoTool}=await import('../src/tools/photo/plugin.js');
 const id1='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
 const set=(id:string,eventName:string)=>({id,eventName,tags:['share2026-10-27','flood'],username:'Alice',appName:'ThaiWater GIS',createdAt:1,photoCount:1,capturedFrom:'2026-10-18T09:30:45',capturedTo:'2026-10-18T09:30:45',bbox:[100,13,100,13],url:`/share/${id}`});
 const requests:string[]=[];let removed=false;
 const client=createPublicClient({fetch:async url=>{const path=String(url);requests.push(path);
  if(path.startsWith('/api/public/photo-shares'))return Response.json({sets:[set(id1,'น้ำท่วมสะพาน'),set(id2,'ตลิ่งพัง')],hasMore:false});
  const match=/^\/api\/photo-shares\/([^/?]+)$/.exec(path);
  if(match){if(removed&&match[1]===id2)return Response.json({error:'ไม่พบข้อมูล'},{status:404});const name=match[1]===id1?'น้ำท่วมสะพาน':'ตลิ่งพัง';return Response.json({id:match[1],eventName:name,tags:['flood'],username:'Alice',photos:[{id:`p-${match[1]}`,name:`${name}.jpg`,longitude:100,latitude:13,capturedAt:'2026-10-18T09:30:45',capturedOffset:'+07:00',url:`/api/photo-shares/${match[1]}/photos/p`,caption:'ระดับน้ำสูง'}]});}
  return Response.json({photos:[],hasMore:false});}});
 const rt:ToolboxRuntime={appId:'sets',storage:createBrowserStorage(`sets-${nextId()}`),client};
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
 assert.match(dom.container.textContent??'',/Public Photos \(ชุดบนแผนที่ 2\)/);
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
 act(()=>dom.root.unmount());dom.root=createRoot(dom.container);removed=true;
 await render(view());await settle();
 assert.deepEqual(titles(),['Public Photos/น้ำท่วมสะพาน']);
 click('#toolbox-public-photos-settings');await settle();
 click('[aria-label="Remove from map ชุด น้ำท่วมสะพาน"]');await settle();
 assert.deepEqual(titles(),[],'removing a set drops its layer');
 assert.equal(localStorage.getItem('toolbox:sets:toolbox.photo:public-photo-sets:u10'),'[]');
});
