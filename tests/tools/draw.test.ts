import {test} from 'node:test';
import assert from 'node:assert/strict';
import {h,act,createLayerRegistry,createPublicClient,createBrowserStorage,ui,ToolboxPanel,ToolOverlays,ToolDialogs,DataPanel,nextId,runtime,layer,fakeMap,settle,dom,render,click} from '../helpers/dom.js';
import type {ToolboxRuntime} from '../../src/ui/context.js';

const {drawTool,useDrawingToolbar}=await import('../../src/tools/draw/plugin.js');

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
 const rt:ToolboxRuntime={appId:'draw',storage:createBrowserStorage(`draw-${nextId()}`),client};
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
 assert.match(dom.container.textContent??'',/กระดาษร่าง 1 วัตถุ/,'the draft from this browser is on the canvas');
 const save=()=>act(async()=>{(document.querySelector('#drawing-set-name')!.closest('form')!.querySelector('button:not([type=button])') as HTMLButtonElement).click();});
 await save();await settle();
 assert.match(document.body.textContent??'',/กรุณาระบุชื่อชุดรูปวาด/,'the set name is required');
 field('#drawing-set-name','แนวคันกั้นน้ำ');field('#drawing-set-tags','flood, คันดิน');
 await save();await settle();
 assert.deepEqual(titles(),['My Drawing/แนวคันกั้นน้ำ'],'the saved set becomes its own layer');
 layerId=registry.getSnapshot().layers[0].id;
 assert.equal(registry.getSnapshot().layers[0].owner?.key,'mine');
 assert.match(dom.container.textContent??'',/กระดาษร่าง 0 วัตถุ/,'the draft is cleared');
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
 act(()=>dom.root.render(view()));await settle();
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
