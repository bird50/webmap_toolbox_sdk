import type {FeatureCollection} from 'geojson';
import type {Map as MapLibreMap,GeoJSONSource,LayerSpecification} from 'maplibre-gl';
import type {GeoJSONStyle,GeoJSONSurface} from '../core/map.js';

export type RegistryLayerSpec={id:string;type:'fill'|'line'|'circle';filter?:unknown[];paint:Record<string,unknown>};
/** Single source of MapLibre styling for registry GeoJSON, shared by RegistryLayers and the imperative surface. */
export function registryLayerSpecs(id:string,style:Pick<GeoJSONStyle,'kind'|'color'|'opacity'>):RegistryLayerSpec[]{
 const prefix=`registry-${id}`,{color,opacity:alpha}=style;
 if(style.kind==='mixed')return [
  {id:`${prefix}-fill`,type:'fill',filter:['==','$type','Polygon'],paint:{'fill-color':color,'fill-opacity':alpha*.3}},
  {id:`${prefix}-line`,type:'line',filter:['in','$type','LineString','Polygon'],paint:{'line-color':color,'line-width':2,'line-opacity':alpha}},
  {id:`${prefix}-point`,type:'circle',filter:['==','$type','Point'],paint:{'circle-color':color,'circle-radius':6,'circle-opacity':alpha,'circle-stroke-color':'#fff','circle-stroke-width':1}},
 ];
 if(style.kind==='fill')return [{id:prefix,type:'fill',paint:{'fill-color':color,'fill-opacity':alpha*.32,'fill-outline-color':color}}];
 if(style.kind==='line')return [{id:prefix,type:'line',paint:{'line-color':color,'line-width':3,'line-opacity':alpha}}];
 return [{id:prefix,type:'circle',paint:{'circle-color':color,'circle-radius':['case',['has','point_count'],18,8],'circle-opacity':alpha,'circle-stroke-color':'#fff','circle-stroke-width':2}}];
}

type Entry={data:FeatureCollection|string;style:GeoJSONStyle;visible:boolean};
/**
 * Imperative GeoJSON layers that survive basemap/style swaps: `styledata` re-adds missing sources/layers
 * and only then re-applies order. moveLayer itself triggers `styledata`, so ordering when nothing changed would
 * keep the style dirty forever and the map would never fire `load`/`idle`. Uses the same IDs as RegistryLayers (`source-<id>`, `registry-<id>[-fill|-line|-point]`),
 * so a host must not render the same registry layer through both.
 */
export function createMapLibreGeoJSONSurface(getMap:()=>MapLibreMap|undefined):GeoJSONSurface&{dispose():void;hitLayers():Map<string,string>}{
 const entries=new Map<string,Entry>();let order:string[]=[];let attached:MapLibreMap|undefined;
 const sourceId=(id:string)=>`source-${id}`;
 const visibility=(entry:Entry)=>entry.visible?'visible':'none';
 // addSource/addLayer throw while a new style is still loading; the next styledata retries.
 const attempt=(fn:()=>void)=>{try{fn();return true;}catch{return false;}};
 /** Adds whatever is missing and reports whether anything was added. */
 function ensure(map:MapLibreMap,id:string,entry:Entry){
  let added=false;
  attempt(()=>{
   if(!map.getSource(sourceId(id))){map.addSource(sourceId(id),{type:'geojson',data:entry.data,cluster:entry.style.kind==='circle'&&!!entry.style.cluster,clusterRadius:45});added=true;}
   for(const spec of registryLayerSpecs(id,entry.style))if(!map.getLayer(spec.id)){map.addLayer({...spec,source:sourceId(id),minzoom:entry.style.minZoom??0,maxzoom:entry.style.maxZoom??24,layout:{visibility:visibility(entry)}} as unknown as LayerSpecification);added=true;}
  });
  return added;
 }
 function drop(map:MapLibreMap,id:string,entry:Entry){
  attempt(()=>{for(const spec of registryLayerSpecs(id,entry.style))if(map.getLayer(spec.id))map.removeLayer(spec.id);if(map.getSource(sourceId(id)))map.removeSource(sourceId(id));});
 }
 function applyOrder(map:MapLibreMap){
  attempt(()=>{for(const id of [...order].reverse()){const entry=entries.get(id);if(!entry)continue;for(const spec of registryLayerSpecs(id,entry.style))if(map.getLayer(spec.id))map.moveLayer(spec.id);}});
 }
 const reapply=()=>{if(!attached)return;let added=false;for(const [id,entry] of entries)if(ensure(attached,id,entry))added=true;if(added)applyOrder(attached);};
 function map(){
  const current=getMap();
  if(current!==attached){attached?.off('styledata',reapply);attached=current;attached?.on('styledata',reapply);}
  return current;
 }
 function paint(current:MapLibreMap,id:string,entry:Entry){
  attempt(()=>{for(const spec of registryLayerSpecs(id,entry.style))if(current.getLayer(spec.id))for(const [key,value] of Object.entries(spec.paint))current.setPaintProperty(spec.id,key as never,value as never);});
 }
 return {
  set(id,data,style){
   if(!id.trim()||!Number.isFinite(style.opacity))throw new Error('Invalid GeoJSON layer');
   const previous=entries.get(id),entry:Entry={data,style:{...style,opacity:Math.max(0,Math.min(1,style.opacity))},visible:previous?.visible??true};
   const current=map();
   if(current&&previous&&(previous.style.kind!==entry.style.kind||!!previous.style.cluster!==!!entry.style.cluster))drop(current,id,previous);
   entries.set(id,entry);if(!current)return;
   if(previous&&previous.data!==data)attempt(()=>(current.getSource(sourceId(id)) as GeoJSONSource|undefined)?.setData(data));
   const added=ensure(current,id,entry);
   // Unchanged values are no-ops in MapLibre, so updating every call does not dirty the style.
   paint(current,id,entry);
   attempt(()=>{for(const spec of registryLayerSpecs(id,entry.style))if(current.getLayer(spec.id))current.setLayerZoomRange(spec.id,entry.style.minZoom??0,entry.style.maxZoom??24);});
   if(added)applyOrder(current);
  },
  remove(id){const entry=entries.get(id);if(!entry)return;entries.delete(id);const current=map();if(current)drop(current,id,entry);},
  setVisible(id,visible){const entry=entries.get(id);if(!entry)return;entry.visible=visible;const current=map();if(current)attempt(()=>{for(const spec of registryLayerSpecs(id,entry.style))if(current.getLayer(spec.id))current.setLayoutProperty(spec.id,'visibility',visibility(entry));});},
  setOpacity(id,opacity){const entry=entries.get(id);if(!entry||!Number.isFinite(opacity))return;entry.style={...entry.style,opacity:Math.max(0,Math.min(1,opacity))};const current=map();if(current)paint(current,id,entry);},
  order(ids){if(ids.length===order.length&&ids.every((id,index)=>id===order[index]))return;order=[...ids];const current=map();if(current)applyOrder(current);},
  layerIds(id){const entry=entries.get(id);return entry?registryLayerSpecs(id,entry.style).map(spec=>spec.id):[];},
  /** Engine layer ID → registry layer ID for layers currently on the map. */
  hitLayers(){const result=new Map<string,string>();const current=getMap();for(const [id,entry] of entries)for(const spec of registryLayerSpecs(id,entry.style))if(current?.getLayer(spec.id))result.set(spec.id,id);return result;},
  dispose(){const current=getMap()??attached;if(current)for(const [id,entry] of entries)drop(current,id,entry);entries.clear();order=[];attached?.off('styledata',reapply);attached=undefined;},
 };
}
