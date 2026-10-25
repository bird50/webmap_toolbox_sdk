import L from 'leaflet';
import type {FeatureCollection} from 'geojson';
import type {GeoJSONStyle,GeoJSONSurface,MapAdapter,MapEvent,MapPointerEvent,MapPointerEventName} from '@thaiwater/toolbox-sdk';

type Hit=MapPointerEvent['features'][number];
type Entry={id:string;layer:L.GeoJSON;style:GeoJSONStyle;visible:boolean};

/** GeoJSON surface on L.geoJSON layers; zoom limits are applied by adding/removing the layer on zoomend. */
function createLeafletGeoJSONSurface(map:L.Map){
 const entries=new Map<string,Entry>();let hits:Hit[]=[];
 const paint=(style:GeoJSONStyle)=>{const mixed=style.kind==='mixed',alpha=style.opacity;return {
  path:{color:style.color,weight:mixed?2:3,opacity:alpha,fillColor:style.color,fillOpacity:alpha*(mixed?.3:.32)},
  point:{radius:style.kind==='circle'?8:6,color:'#fff',weight:style.kind==='circle'?2:1,opacity:alpha,fillColor:style.color,fillOpacity:alpha},
 };};
 const inRange=(entry:Entry)=>{const zoom=map.getZoom();return zoom>=(entry.style.minZoom??0)&&zoom<=(entry.style.maxZoom??24);};
 const sync=(entry:Entry)=>{const show=entry.visible&&inRange(entry);if(show&&!map.hasLayer(entry.layer))entry.layer.addTo(map);if(!show&&map.hasLayer(entry.layer))entry.layer.remove();};
 const restyle=(entry:Entry)=>{const {path,point}=paint(entry.style);entry.layer.eachLayer(layer=>{if(layer instanceof L.CircleMarker)layer.setStyle(point);else if(layer instanceof L.Path)layer.setStyle(path);});};
 const onZoom=()=>entries.forEach(sync);map.on('zoomend',onZoom);
 function build(id:string,data:FeatureCollection|null,style:GeoJSONStyle){
  const {path,point}=paint(style);
  return L.geoJSON(data??undefined,{style:()=>path,pointToLayer:(_feature,latlng)=>L.circleMarker(latlng,point),
   // Feature clicks fire before the map's click, so the map listener can report what was hit.
   onEachFeature:(feature,layer)=>layer.on('click',()=>{hits.push({layerId:id,properties:{...feature.properties}});})});
 }
 const surface:GeoJSONSurface&{dispose():void;takeHits():Hit[]}={
  set(id,data,style){
   if(!id.trim()||!Number.isFinite(style.opacity))throw new Error('Invalid GeoJSON layer');
   const previous=entries.get(id);previous?.layer.remove();
   const entry:Entry={id,style,visible:previous?.visible??true,layer:build(id,typeof data==='string'?null:data,style)};
   if(typeof data==='string')void fetch(data).then(response=>response.json()).then(json=>{if(entries.get(id)===entry)entry.layer.addData(json);}).catch(()=>{});
   entries.set(id,entry);sync(entry);
  },
  remove(id){entries.get(id)?.layer.remove();entries.delete(id);},
  setVisible(id,visible){const entry=entries.get(id);if(entry){entry.visible=visible;sync(entry);}},
  setOpacity(id,opacity){const entry=entries.get(id);if(entry&&Number.isFinite(opacity)){entry.style={...entry.style,opacity:Math.max(0,Math.min(1,opacity))};restyle(entry);}},
  order(ids){for(const id of [...ids].reverse()){const entry=entries.get(id);if(entry&&map.hasLayer(entry.layer))entry.layer.bringToFront();}},
  layerIds:id=>entries.has(id)?[id]:[],
  takeHits(){const taken=hits;hits=[];return taken;},
  dispose(){entries.forEach(entry=>entry.layer.remove());entries.clear();map.off('zoomend',onZoom);},
 };
 return surface;
}

/** MapAdapter for Leaflet: viewport, projection, navigation, events, pointer hits, overlay container and a GeoJSON surface. */
export function createLeafletAdapter(map:L.Map):MapAdapter{
 const surface=createLeafletGeoJSONSurface(map);
 // Overlays must follow zoom animation frames too, not only pans.
 const engineEvents:Record<MapEvent,string[]>={move:['move','zoom'],moveend:['moveend'],resize:['resize'],load:['load']};
 const listeners=new Map<()=>void,{event:MapEvent}>();
 const pointers=new Map<(event:MapPointerEvent)=>void,{event:MapPointerEventName;handler:(event:L.LeafletMouseEvent)=>void}>();
 const engineName=(event:MapPointerEventName)=>event==='click'?'click':'mousemove';
 const valid=(lng:number,lat:number)=>Number.isFinite(lng)&&Number.isFinite(lat)&&Math.abs(lng)<=180&&Math.abs(lat)<=90;
 return {
  getSize(){const size=map.getSize();return {width:size.x,height:size.y};},
  getZoom:()=>map.getZoom(),
  getBounds(){const bounds=map.getBounds();return {getWest:()=>bounds.getWest(),getSouth:()=>bounds.getSouth(),getEast:()=>bounds.getEast(),getNorth:()=>bounds.getNorth()};},
  project([lng,lat]){const point=map.latLngToContainerPoint([lat,lng]);return {x:point.x,y:point.y};},
  unproject([x,y]){const latlng=map.containerPointToLatLng([x,y]);return {lng:latlng.lng,lat:latlng.lat};},
  navigate({longitude,latitude,zoom}){if(!valid(longitude,latitude)||!Number.isFinite(zoom)||zoom<0||zoom>24)throw new Error('Invalid view');map.flyTo([latitude,longitude],zoom);},
  fitBounds([[west,south],[east,north]]){if(!valid(west,south)||!valid(east,north))throw new Error('Invalid bounds');map.fitBounds([[south,west],[north,east]],{padding:[60,60],maxZoom:14});},
  on(event,listener){engineEvents[event].forEach(name=>map.on(name,listener));listeners.set(listener,{event});},
  off(event,listener){engineEvents[event].forEach(name=>map.off(name,listener));listeners.delete(listener);},
  onPointer(event,listener){
   const handler=(e:L.LeafletMouseEvent)=>listener({lngLat:{lng:e.latlng.lng,lat:e.latlng.lat},point:{x:e.containerPoint.x,y:e.containerPoint.y},features:event==='click'?surface.takeHits():[]});
   map.on(engineName(event),handler as L.LeafletEventHandlerFn);pointers.set(listener,{event,handler});
  },
  offPointer(event,listener){const item=pointers.get(listener);if(item&&item.event===event){map.off(engineName(event),item.handler as L.LeafletEventHandlerFn);pointers.delete(listener);}},
  getContainer:()=>map.getContainer(),
  geojson:surface,
  dispose(){
   listeners.forEach(({event},listener)=>engineEvents[event].forEach(name=>map.off(name,listener)));listeners.clear();
   pointers.forEach(({event,handler})=>map.off(engineName(event),handler as L.LeafletEventHandlerFn));pointers.clear();
   surface.dispose();
  },
 };
}
