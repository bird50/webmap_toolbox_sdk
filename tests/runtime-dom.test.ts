import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {GlobalRegistrator} from '@happy-dom/global-registrator';
import type {LayerDefinition} from '../src/core/layers.js';
import type {MapAdapter,GeoJSONSurface} from '../src/core/map.js';
import type {ToolPlugin} from '../src/ui/contracts.js';
import type {ToolboxRuntime} from '../src/ui/context.js';

// react-dom detects the DOM when it loads, so register globals before importing it.
GlobalRegistrator.register();
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const {createElement:h,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {createLayerRegistry}=await import('../src/core/registry.js');
const ui=await import('../src/ui/context.js');
const {ToolboxPanel,ToolOverlays,ToolDialogs}=await import('../src/ui/runtime.js');

const runtime={appId:'test',storage:{},client:{}} as unknown as ToolboxRuntime;
const layer=(id:string,extra:Partial<LayerDefinition>={}):LayerDefinition=>({id,title:id,description:'',group:'test',type:'GEOJSON',url:'local:test',visible:false,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#000',legend:'',popupFields:[],...extra});
const plugin=(id:string,extra:Partial<ToolPlugin>={}):ToolPlugin=>({id,title:`Tool ${id}`,version:'1.0.0',apiVersion:'2.0',accessLevel:'PUBLIC',requires:[],Panel:()=>h('p',null,`panel:${id}`),...extra});
const fakeMap=(geojson=true):MapAdapter=>({getSize:()=>({width:1,height:1}),getZoom:()=>5,getBounds:()=>null,project:()=>({x:0,y:0}),unproject:()=>({lng:0,lat:0}),navigate(){},fitBounds(){},on(){},off(){},dispose(){},...(geojson?{geojson:{} as GeoJSONSurface}:{})});

let container:HTMLElement,root:ReturnType<typeof createRoot>;
function render(node:ReturnType<typeof h>){container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(node));}
const text=()=>container.textContent??'';
afterEach(()=>{act(()=>root.unmount());container.remove();});

test('provider mounts tools by access and capabilities, registers their layers and removes them on unmount',()=>{
 const registry=createLayerRegistry([layer('basins')],'MEMBER');
 const plugins=[plugin('a',{layers:[layer('a1'),layer('a2')]}),plugin('admin',{accessLevel:'ADMIN',layers:[layer('secret')]}),plugin('geo',{requires:['map.geojson'],layers:[layer('g1')]})];
 const view=(map?:MapAdapter)=>h(ui.ToolboxProvider,{runtime,plugins,registry,user:{id:'u1',accessLevel:'MEMBER'},map},h(ToolboxPanel));
 render(view());
 assert.match(text(),/panel:a/);assert.doesNotMatch(text(),/panel:admin|panel:geo/);
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins','a1','a2']);
 assert.deepEqual(registry.getSnapshot().layers[1].owner,{toolId:'a',key:'a1'});
 act(()=>root.render(view(fakeMap(false))));
 assert.doesNotMatch(text(),/panel:geo/,'map without a GeoJSON surface does not satisfy map.geojson');
 act(()=>root.render(view(fakeMap())));
 assert.match(text(),/panel:geo/);
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins','a1','a2','g1']);
 act(()=>root.unmount());render(h('div'));
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins']);
});
test('toolLayers="start" puts tool layers above host layers in tool order',()=>{
 const registry=createLayerRegistry([layer('basins')]);
 render(h(ui.ToolboxProvider,{runtime,registry,toolLayers:'start',plugins:[plugin('files',{layers:[layer('my-files')]}),plugin('draw',{layers:[layer('my-drawing'),layer('public-drawing')]})]},h(ToolboxPanel)));
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['my-files','my-drawing','public-drawing','basins']);
});
test('Panel and Dialogs of one tool share useToolState; other tools keep their own slice',()=>{
 function Counter(){const [count,setCount]=ui.useToolState('count',0);return h('button',{id:`inc-${ui.useToolId()}`,onClick:()=>setCount(n=>n+1)},'+');}
 function Shown(){const [count]=ui.useToolState('count',0);return h('output',{id:`out-${ui.useToolId()}`},String(count));}
 render(h(ui.ToolboxProvider,{runtime,plugins:[plugin('a',{Panel:Counter,Dialogs:Shown}),plugin('b',{Panel:Counter,Dialogs:Shown})]},h(ToolboxPanel),h(ToolDialogs)));
 act(()=>{(container.querySelector('#inc-a') as HTMLButtonElement).click();});
 act(()=>{(container.querySelector('#inc-a') as HTMLButtonElement).click();});
 assert.equal(container.querySelector('#out-a')?.textContent,'2');
 assert.equal(container.querySelector('#out-b')?.textContent,'0');
});
test('overlays render only with a map in scope; panels outside the map see the attached adapter',()=>{
 const map=fakeMap();
 function MapStatus(){return h('span',null,ui.useMapAdapter()?'map:ready':'map:none');}
 const plugins=[plugin('a',{Panel:MapStatus,Overlay:()=>h('i',null,'overlay:a')})];
 render(h(ui.ToolboxProvider,{runtime,plugins},h(ToolboxPanel),h(ToolOverlays)));
 assert.match(text(),/map:none/);assert.doesNotMatch(text(),/overlay:a/);
 act(()=>root.render(h(ui.ToolboxProvider,{runtime,plugins},h(ToolboxPanel),h(ui.MapAdapterProvider,{adapter:map},h(ToolOverlays)))));
 assert.match(text(),/map:ready/);assert.match(text(),/overlay:a/);
});
test('a layer ID conflict or a render error disables only that tool, with a visible message',()=>{
 const registry=createLayerRegistry([layer('basins')]);
 function Broken():never{throw new Error('boom');}
 const original=console.error;console.error=()=>{};
 try{
  render(h(ui.ToolboxProvider,{runtime,registry,plugins:[plugin('clash',{layers:[layer('basins')]}),plugin('broken',{Panel:Broken}),plugin('ok')]},h(ToolboxPanel)));
 }finally{console.error=original;}
 assert.match(text(),/เพิ่มชั้นข้อมูลของเครื่องมือ Tool clash ไม่สำเร็จ/);assert.doesNotMatch(text(),/panel:clash/);
 assert.match(text(),/เปิดเครื่องมือ Tool broken ไม่สำเร็จ/);
 assert.match(text(),/panel:ok/);
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins']);
});
test('useLayer and useToolLayers read and change the shared registry',()=>{
 const registry=createLayerRegistry([layer('basins')]);
 function Layers(){const own=ui.useToolLayers();const first=ui.useLayer(own[0]?.id??'');return h('button',{id:'toggle',onClick:()=>first?.setVisible(!first.visible)},`${own.map(l=>l.id).join(',')}:${first?.visible}`);}
 render(h(ui.ToolboxProvider,{runtime,registry,plugins:[plugin('files',{Panel:Layers,layers:[layer('my-files'),layer('more')]})]},h(ToolboxPanel)));
 assert.equal(text(),'my-files,more:false');
 act(()=>{(container.querySelector('#toggle') as HTMLButtonElement).click();});
 assert.equal(text(),'my-files,more:true');assert.equal(registry.getSnapshot().visible['my-files'],true);
});
test('runtime-only provider keeps 1.0 behaviour; messages can be overridden',()=>{
 function Runtime(){return h('span',null,ui.useToolbox().appId);}
 render(h(ui.ToolboxProvider,{runtime,messages:{noTools:'no tools'}},h(Runtime),h(ToolboxPanel),h(ToolDialogs)));
 assert.equal(text(),'testno tools');
});
