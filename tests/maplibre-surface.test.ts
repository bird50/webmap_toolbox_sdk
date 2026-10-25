import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Map as MapLibreMap} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import {createMapLibreGeoJSONSurface,registryLayerSpecs} from '../src/adapters/maplibre-geojson.js';
import {createMapLibreAdapter} from '../src/adapters/maplibre.js';
import {interactiveRegistryIds} from '../src/adapters/RegistryLayers.js';
import {mapCapabilities} from '../src/ui/contracts.js';
import type {LayerDefinition} from '../src/core/layers.js';
import type {MapPointerEvent} from '../src/core/map.js';

type FakeLayer={id:string;type:string;source:string;paint:Record<string,unknown>;layout:Record<string,unknown>;minzoom:number;maxzoom:number;filter?:unknown};
/** In-memory stand-in for the parts of maplibre-gl the surface uses; the layers array is bottom → top. */
function fakeMap(){
 const sources=new Map<string,{data:unknown;cluster:boolean;setData(data:unknown):void}>();let layers:FakeLayer[]=[];
 const handlers=new Map<string,Set<(event?:unknown)=>void>>();let loading=false;const container={} as HTMLElement;
 const guard=()=>{if(loading)throw new Error('Style is not done loading');};
 const map={
  getSource:(id:string)=>sources.get(id),
  addSource(id:string,spec:{data:unknown;cluster:boolean}){guard();sources.set(id,{...spec,setData(data){this.data=data;}});},
  removeSource(id:string){sources.delete(id);},
  getLayer:(id:string)=>layers.find(l=>l.id===id),
  addLayer(spec:FakeLayer){guard();layers.push({...spec,paint:{...spec.paint},layout:{...spec.layout}});},
  removeLayer(id:string){layers=layers.filter(l=>l.id!==id);},
  moveLayer(id:string){const layer=layers.find(l=>l.id===id)!;layers=[...layers.filter(l=>l!==layer),layer];},
  setPaintProperty(id:string,key:string,value:unknown){map.getLayer(id)!.paint[key]=value;},
  setLayoutProperty(id:string,key:string,value:unknown){map.getLayer(id)!.layout[key]=value;},
  setLayerZoomRange(id:string,min:number,max:number){Object.assign(map.getLayer(id)!,{minzoom:min,maxzoom:max});},
  on(event:string,fn:(event?:unknown)=>void){if(!handlers.has(event))handlers.set(event,new Set());handlers.get(event)!.add(fn);},
  off(event:string,fn:(event?:unknown)=>void){handlers.get(event)?.delete(fn);},
  queryRenderedFeatures(_point:unknown,options:{layers:string[]}){return options.layers.map(id=>({layer:{id},properties:{name:id}}));},
  getContainer:()=>container,
 };
 return {
  map:map as unknown as MapLibreMap,container,sources,
  layers:()=>layers.map(l=>l.id),layer:(id:string)=>map.getLayer(id)!,
  fire(event:string,payload?:unknown){handlers.get(event)?.forEach(fn=>fn(payload));},
  listeners:(event:string)=>handlers.get(event)?.size??0,
  /** Simulates setStyle(): host layers stay, everything else is dropped until the new style loads. */
  swapStyle(){layers=layers.filter(l=>l.id.startsWith('host'));sources.clear();loading=true;},
  setLoading(value:boolean){loading=value;},
  addHostLayer(id:string){layers.push({id,type:'background',source:'',paint:{},layout:{},minzoom:0,maxzoom:24});},
 };
}
const data:FeatureCollection={type:'FeatureCollection',features:[]};

test('registry specs keep the 0.1.x MapLibre ids and paint, so RegistryLayers output is unchanged',()=>{
 assert.deepEqual(registryLayerSpecs('files',{kind:'mixed',color:'#f59e0b',opacity:.5}),[
  {id:'registry-files-fill',type:'fill',filter:['==','$type','Polygon'],paint:{'fill-color':'#f59e0b','fill-opacity':.15}},
  {id:'registry-files-line',type:'line',filter:['in','$type','LineString','Polygon'],paint:{'line-color':'#f59e0b','line-width':2,'line-opacity':.5}},
  {id:'registry-files-point',type:'circle',filter:['==','$type','Point'],paint:{'circle-color':'#f59e0b','circle-radius':6,'circle-opacity':.5,'circle-stroke-color':'#fff','circle-stroke-width':1}},
 ]);
 assert.deepEqual(registryLayerSpecs('b',{kind:'fill',color:'#15b8a6',opacity:1})[0].paint,{'fill-color':'#15b8a6','fill-opacity':.32,'fill-outline-color':'#15b8a6'});
 assert.deepEqual(registryLayerSpecs('l',{kind:'line',color:'#000',opacity:1})[0].paint,{'line-color':'#000','line-width':3,'line-opacity':1});
 assert.deepEqual(registryLayerSpecs('s',{kind:'circle',color:'#2563eb',opacity:1})[0].paint['circle-radius'],['case',['has','point_count'],18,8]);
 const layer=(id:string,extra:Partial<LayerDefinition>):LayerDefinition=>({id,title:id,description:'',group:'',type:'GEOJSON',url:'x',visible:true,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#000',legend:'',popupFields:[],...extra});
 const layers=[layer('files',{render:{kind:'mixed'}}),layer('basins',{render:{kind:'fill'}}),layer('off',{render:{kind:'line'}}),layer('nourl',{url:'',render:{kind:'circle'}}),layer('photos',{})];
 assert.deepEqual(interactiveRegistryIds(layers,{files:true,basins:true,nourl:true,photos:true}),['registry-files-fill','registry-files-line','registry-files-point','registry-basins']);
});
test('surface creates, updates, hides, fades and removes layers under registry ids',()=>{
 const fake=fakeMap(),surface=createMapLibreGeoJSONSurface(()=>fake.map);
 surface.set('files',data,{kind:'mixed',color:'#f59e0b',opacity:1,minZoom:2,maxZoom:18});
 assert.deepEqual(fake.layers(),['registry-files-fill','registry-files-line','registry-files-point']);
 assert.deepEqual(surface.layerIds('files'),fake.layers());
 assert.equal(fake.layer('registry-files-fill').source,'source-files');assert.equal(fake.layer('registry-files-fill').minzoom,2);
 const next:FeatureCollection={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[100,13]}}]};
 surface.set('files',next,{kind:'mixed',color:'#f59e0b',opacity:1,minZoom:4,maxZoom:18});
 assert.equal(fake.sources.get('source-files')!.data,next);assert.equal(fake.layer('registry-files-point').minzoom,4);
 surface.setVisible('files',false);assert.equal(fake.layer('registry-files-line').layout.visibility,'none');
 surface.setOpacity('files',.5);assert.equal(fake.layer('registry-files-fill').paint['fill-opacity'],.15);
 surface.set('files',next,{kind:'circle',color:'#2563eb',opacity:1,cluster:true});
 assert.deepEqual(fake.layers(),['registry-files']);assert.equal(fake.sources.get('source-files')!.cluster,true);
 assert.equal(fake.layer('registry-files').layout.visibility,'none');
 surface.remove('files');assert.deepEqual(fake.layers(),[]);assert.equal(fake.sources.size,0);assert.deepEqual(surface.layerIds('files'),[]);
 assert.throws(()=>surface.set(' ',data,{kind:'fill',color:'#000',opacity:1}));
});
test('order puts the first id on top without touching host layers',()=>{
 const fake=fakeMap(),surface=createMapLibreGeoJSONSurface(()=>fake.map);fake.addHostLayer('host-background');
 surface.set('a',data,{kind:'fill',color:'#000',opacity:1});surface.set('b',data,{kind:'line',color:'#000',opacity:1});
 surface.order(['a','missing','b']);
 assert.deepEqual(fake.layers(),['host-background','registry-b','registry-a']);
 surface.set('c',data,{kind:'circle',color:'#000',opacity:1});surface.order(['c','a','b']);
 assert.deepEqual(fake.layers(),['host-background','registry-b','registry-a','registry-c']);
});
test('a basemap swap re-adds layers with their state once the new style has loaded',()=>{
 const fake=fakeMap(),surface=createMapLibreGeoJSONSurface(()=>fake.map);
 surface.set('a',data,{kind:'fill',color:'#000',opacity:1});surface.set('b',data,{kind:'line',color:'#000',opacity:1});
 surface.setVisible('a',false);surface.setOpacity('b',.4);surface.order(['a','b']);
 fake.swapStyle();fake.fire('styledata');
 assert.deepEqual(fake.layers(),[]);
 fake.setLoading(false);fake.fire('styledata');
 assert.deepEqual(fake.layers(),['registry-b','registry-a']);
 assert.equal(fake.layer('registry-a').layout.visibility,'none');assert.equal(fake.layer('registry-b').paint['line-opacity'],.4);
});
test('set during style load is deferred to styledata; dispose removes layers and the listener',()=>{
 const fake=fakeMap(),surface=createMapLibreGeoJSONSurface(()=>fake.map);
 fake.setLoading(true);surface.set('a',data,{kind:'fill',color:'#000',opacity:1});assert.deepEqual(fake.layers(),[]);
 fake.setLoading(false);fake.fire('styledata');assert.deepEqual(fake.layers(),['registry-a']);
 assert.equal(fake.listeners('styledata'),1);
 surface.dispose();assert.deepEqual(fake.layers(),[]);assert.equal(fake.listeners('styledata'),0);
 fake.fire('styledata');assert.deepEqual(fake.layers(),[]);
 surface.set('a',data,{kind:'fill',color:'#000',opacity:1});assert.deepEqual(fake.layers(),['registry-a']);assert.equal(fake.listeners('styledata'),1);
});
test('adapter exposes pointer events with surface hits, container and capabilities; dispose cleans all',()=>{
 const fake=fakeMap(),adapter=createMapLibreAdapter(()=>fake.map);
 assert.deepEqual(mapCapabilities(adapter),['map.viewport','map.project','map.events','map.pointer','map.geojson','map.overlay']);
 assert.equal(adapter.getContainer?.(),fake.container);
 const clicks:MapPointerEvent[]=[];const onClick=(event:MapPointerEvent)=>clicks.push(event);
 adapter.onPointer!('click',onClick);adapter.onPointer!('pointermove',()=>{});
 assert.equal(fake.listeners('click'),1);assert.equal(fake.listeners('mousemove'),1);
 const event={point:{x:5,y:6},lngLat:{lng:100,lat:13}};
 fake.fire('click',event);assert.deepEqual(clicks[0],{lngLat:{lng:100,lat:13},point:{x:5,y:6},features:[]});
 adapter.geojson!.set('files',data,{kind:'mixed',color:'#000',opacity:1});
 fake.fire('click',event);
 assert.deepEqual(clicks[1].features.map(f=>f.layerId),['files','files','files']);
 assert.equal(clicks[1].features[0].properties.name,'registry-files-fill');
 adapter.offPointer!('click',onClick);assert.equal(fake.listeners('click'),0);
 adapter.dispose();assert.equal(fake.listeners('mousemove'),0);assert.deepEqual(fake.layers(),[]);
});
