import {afterEach} from 'node:test';
import 'fake-indexeddb/auto';
import {GlobalRegistrator} from '@happy-dom/global-registrator';
import type {LayerDefinition} from '../../src/core/layers.js';
import type {MapAdapter,GeoJSONSurface} from '../../src/core/map.js';
import type {ToolboxRuntime} from '../../src/ui/context.js';

/**
 * Shared setup of the DOM plugin tests (tests/plugins-dom.test.ts and tests/tools/*.test.ts): happy-dom, React,
 * the runtime and a recording map. Import it first; import tool code afterwards with `await import(...)`, because
 * React DOM checks for a DOM when it loads.
 */
// fake-indexeddb must keep Node's IndexedDB globals; happy-dom only adds the DOM.
GlobalRegistrator.register();
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
export const {createElement:h,act}=await import('react');
export const {createRoot}=await import('react-dom/client');
export const {createLayerRegistry}=await import('../../src/core/registry.js');
export const {createPublicClient}=await import('../../src/core/client.js');
export const {createBrowserStorage}=await import('../../src/storage/index.js');
export const ui=await import('../../src/ui/context.js');
export const {ToolboxPanel,ToolOverlays,ToolDialogs}=await import('../../src/ui/runtime.js');
export const {DataPanel}=await import('../../src/ui/DataPanel.js');

let counter=0;
/** A fresh number per call, for unique database names. */
export const nextId=()=>++counter;
export const runtime=():ToolboxRuntime=>({appId:'plugins',storage:createBrowserStorage(`plugins-${nextId()}`),client:createPublicClient({fetch:async()=>Response.json({photos:[],drawings:[],hasMore:false})})});
export const layer=(id:string,extra:Partial<LayerDefinition>={}):LayerDefinition=>({id,title:id,description:'',group:'host',type:'GEOJSON',url:'/x',visible:true,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#000',legend:'',popupFields:[],...extra});
type Call=[string,...unknown[]];
export function fakeMap(){
 const calls:Call[]=[];const record=(name:string)=>(...args:unknown[])=>{calls.push([name,...args]);};
 const geojson:GeoJSONSurface={set:record('set'),remove:record('remove'),setVisible:record('setVisible'),setOpacity:record('setOpacity'),order:record('order'),layerIds:()=>[]};
 const map:MapAdapter={getSize:()=>({width:800,height:600}),getZoom:()=>5,getBounds:()=>({getWest:()=>99,getSouth:()=>12,getEast:()=>101,getNorth:()=>14}),project:()=>({x:0,y:0}),unproject:()=>({lng:100,lat:13}),navigate:record('navigate'),fitBounds:record('fitBounds'),on(){},off(){},dispose(){},geojson,getContainer:()=>null,onPointer(){},offPointer(){}};
 return {map,calls,named:(name:string)=>calls.filter(call=>call[0]===name)};
}
export const settle=()=>act(async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setTimeout(resolve,20));});
/** The rendered test tree; tests may replace `root` (e.g. to remount) and the hook below unmounts it. */
export const dom={} as {container:HTMLElement;root:ReturnType<typeof createRoot>};
export async function render(node:ReturnType<typeof h>){dom.container=document.createElement('div');document.body.append(dom.container);dom.root=createRoot(dom.container);act(()=>dom.root.render(node));await settle();}
export const click=(selector:string)=>act(()=>{(document.querySelector(selector) as HTMLElement).click();});
afterEach(()=>{act(()=>dom.root.unmount());dom.container.remove();document.body.innerHTML='';});
