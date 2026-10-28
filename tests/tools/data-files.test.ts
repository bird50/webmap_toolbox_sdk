import {test} from 'node:test';
import assert from 'node:assert/strict';
import {h,act,createLayerRegistry,createPublicClient,createBrowserStorage,ui,ToolboxPanel,ToolOverlays,ToolDialogs,DataPanel,nextId,runtime,layer,fakeMap,settle,dom,render,click} from '../helpers/dom.js';
import type {ToolboxRuntime} from '../../src/ui/context.js';

const {dataFilesTool}=await import('../../src/tools/data-files/plugin.js');

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
 assert.match(dom.container.textContent??'',/My Data Files \(ชุดบนแผนที่ 1 · ชุด 2\)/);
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
test('tool entries work without configured storage: each tool opens its own default database',async()=>{
 const {dataFilesTool:filesFromEntry}=await import('../../src/tools/data-files/index.js');
 const {createDataFileStorage}=await import('../../src/tools/data-files/data-file-storage.js');
 await createDataFileStorage('toolbox:entry-only:files:v1')('u8',{add:{name:'a.geojson',description:'',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[100,13]}}]}}});
 const {map}=fakeMap();
 const bare={appId:'entry-only',client:createPublicClient()} as ToolboxRuntime;
 await render(h(ui.ToolboxProvider,{runtime:bare,registry:createLayerRegistry([],'MEMBER'),user:{id:'u8',accessLevel:'MEMBER'},map,plugins:[filesFromEntry()]},h(ToolboxPanel)));
 assert.match(dom.container.textContent??'',/My Data Files \(ชุดบนแผนที่ 0 · ชุด 1\)/);
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
 assert.match(dom.container.textContent??'',/1 ค่า · ต่ำสุด 3.5/,'chart summarises the filtered rows, numeric column first');
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
 const rt:ToolboxRuntime={appId:'files',storage:createBrowserStorage(`files-${nextId()}`),client};
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
