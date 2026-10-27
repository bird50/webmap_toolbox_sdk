"use client";
import {photoOverlayTh} from "./messages/photoOverlay.js";
import {useEffect,useRef,useState} from "react";
import {Camera,X} from "lucide-react";
import type {LayerDefinition} from "../core/layers.js";
import type {MapAdapter} from "../core/map.js";
import {photoViewportBbox,type PublicPhotoFilters} from "../core/public-photo-query.js";
import {formatExpiry} from "../storage/expiry.js";
import {useToolbox,useToolboxMap,useToolText} from "./context.js";

export type MapPhoto={id:string;name:string;url:string;longitude:number;latitude:number;expiresAt?:number;eventName?:string;username?:string;capturedAt?:string;capturedOffset?:string|null;tags?:string[];shareUrl?:string;caption?:string};
export type PublicPhotoStatus={count:number;loading:boolean;error:string;hasMore:boolean};

/** Re-renders on every move/resize so HTML markers follow the map; returns the current size. */
function useMapFrame(map:MapAdapter){
  const [frame,setFrame]=useState(()=>map.getSize());
  useEffect(()=>{
    const refresh=()=>setFrame({...map.getSize()});
    refresh();map.on("move",refresh);map.on("resize",refresh);map.on("moveend",refresh);
    return ()=>{map.off("move",refresh);map.off("resize",refresh);map.off("moveend",refresh);};
  },[map]);
  return frame;
}
/** Viewport-bounded public photo query: debounced, cancels stale requests, reloads on `notify("photos")`. */
function usePublicPhotos(map:MapAdapter,layer:LayerDefinition,filters:PublicPhotoFilters,onStatus:(status:PublicPhotoStatus)=>void){
  const {client}=useToolbox();
  const t=useToolText("photoOverlay",photoOverlayTh),messages=useRef(t);messages.current=t;
  const [photos,setPhotos]=useState<MapPhoto[]>([]);
  useEffect(()=>{
    let controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>,disposed=false;
    async function load(){
      controller?.abort();controller=new AbortController();const active=controller;
      const bounds=map.getBounds();if(!bounds)return;
      if(map.getZoom()<layer.minZoom||map.getZoom()>layer.maxZoom){setPhotos([]);onStatus({count:0,loading:false,error:"",hasMore:false});return;}
      onStatus({count:0,loading:true,error:"",hasMore:false});
      try{
        const bbox=photoViewportBbox(bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth());
        const response=await client.request("photos",{signal:active.signal,cache:"no-store"},new URLSearchParams({bbox,limit:"200",...filters}));
        if(!response.ok)throw new Error("Public Photos unavailable");
        const result=await response.json() as {photos:MapPhoto[];hasMore:boolean};
        if(disposed||active.signal.aborted)return;
        setPhotos(result.photos.map(p=>({...p,url:client.url(p.url),shareUrl:p.shareUrl?client.url(p.shareUrl):undefined})));
        onStatus({count:result.photos.length,loading:false,error:"",hasMore:result.hasMore});
      }catch{
        if(disposed||active.signal.aborted)return;
        setPhotos([]);onStatus({count:0,loading:false,error:messages.current.loadFailed,hasMore:false});
      }
    }
    function schedule(){controller?.abort();clearTimeout(timer);timer=setTimeout(()=>void load(),250);}
    map.on("load",schedule);map.on("moveend",schedule);const unsubscribe=client.subscribe("photos",schedule);schedule();
    return ()=>{disposed=true;controller?.abort();clearTimeout(timer);map.off("load",schedule);map.off("moveend",schedule);unsubscribe();};
  },[map,layer,onStatus,filters,client]);
  return photos;
}
/** Opens towards the larger half of the map and stays inside it horizontally, so the popup is never clipped. */
function popupPlacement(anchor:{x:number;y:number},width:number,height:number){
  const half=Math.min(150,width/2),left=Math.max(half,Math.min(width-half,anchor.x));
  return anchor.y>height/2?{left,top:anchor.y-24,transform:"translate(-50%,-100%)"}:{left,top:anchor.y+24,transform:"translate(-50%,0)"};
}
/** Markers and one popup as HTML positioned with `MapAdapter.project`, so any engine with an adapter can show photos. */
function PhotoMarkers({map,layer,photos,opacity}:{map:MapAdapter;layer:LayerDefinition;photos:MapPhoto[];opacity:number}){
  const {width,height}=useMapFrame(map);
  const t=useToolText("photoOverlay",photoOverlayTh);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const photo=photos.find(item=>item.id===selectedId);
  useEffect(()=>{if(!photo)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelectedId(null);};window.addEventListener("keydown",close);return ()=>window.removeEventListener("keydown",close);},[photo]);
  const place=(item:MapPhoto)=>map.project([item.longitude,item.latitude]);
  const inView=(point:{x:number;y:number})=>point.x>-40&&point.y>-40&&point.x<width+40&&point.y<height+40;
  const anchor=photo&&place(photo);
  return <>
    {photos.map(item=>{const point=place(item);return inView(point)&&<button key={item.id} type="button" aria-label={t.view(item.name)} title={item.eventName??item.name} className="pointer-events-auto absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-white shadow-lg transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-[color:var(--sdk-ring,#0d9488)]" style={{left:point.x,top:point.y,opacity,backgroundColor:layer.color}} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setSelectedId(item.id);}}><Camera size={18} aria-hidden="true"/></button>;})}
    {photo&&anchor&&inView(anchor)&&<div role="dialog" aria-label={photo.name} className="pointer-events-auto absolute z-10 max-h-[calc(50%-32px)] w-[min(300px,80vw)] overflow-auto rounded-lg bg-white p-3 text-left shadow-xl" style={popupPlacement(anchor,width,height)} onPointerDown={event=>event.stopPropagation()}>
      <button type="button" aria-label={t.close} className="absolute right-1 top-1 grid size-6 place-items-center rounded text-[color:var(--sdk-muted,#64748b)]" onClick={()=>setSelectedId(null)}><X size={14}/></button>
      {photo.expiresAt&&<p className="mb-2 pr-6 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.storedUntil(formatExpiry(photo.expiresAt))}</p>}
      {photo.eventName&&<p className="mb-1 pr-6 text-sm font-semibold text-[color:var(--sdk-info,#0369a1)]">{photo.eventName}</p>}
      <p className="mb-2 pr-6 text-xs font-semibold">{photo.name}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.caption||photo.name} className="max-h-64 w-full object-contain"/>
      {photo.caption&&<p className="mt-2 whitespace-pre-line break-words text-xs leading-5">{photo.caption}</p>}
      {photo.username&&<p className="mt-2 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.sharedBy(photo.username)}</p>}
      {photo.capturedAt&&<p className="mt-2 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.capturedAt(photo.capturedAt.replace("T"," "))} {photo.capturedOffset?`UTC${photo.capturedOffset}`:t.cameraTime}</p>}
      {photo.tags&&<p className="mt-1 break-words text-[10px] text-[color:var(--sdk-info,#0369a1)]">{photo.tags.map(tag=>`#${tag}`).join(" ")}</p>}
      {photo.shareUrl&&<a href={photo.shareUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs text-[color:var(--sdk-primary,#0f766e)] underline">{t.viewSet}</a>}
    </div>}
  </>;
}
function RemotePhotos({map,layer,opacity,filters,onStatus}:{map:MapAdapter;layer:LayerDefinition;opacity:number;filters:PublicPhotoFilters;onStatus:(status:PublicPhotoStatus)=>void}){
  return <PhotoMarkers map={map} layer={layer} photos={usePublicPhotos(map,layer,filters,onStatus)} opacity={opacity}/>;
}
/** Engine-neutral photo layers: one marker set per visible event layer (browser photos), `shared` queries public photos for the viewport. */
export function PhotoOverlay({events,shared,visible,opacity,publicFilters,onPublicStatus}:{events:readonly {layer:LayerDefinition;photos:MapPhoto[]}[];shared?:LayerDefinition;visible:Readonly<Record<string,boolean>>;opacity:Readonly<Record<string,number>>;publicFilters:PublicPhotoFilters;onPublicStatus:(status:PublicPhotoStatus)=>void}){
  const {current:map}=useToolboxMap();
  return <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
    {events.map(({layer,photos})=>visible[layer.id]&&<PhotoMarkers key={layer.id} map={map} layer={layer} photos={photos} opacity={opacity[layer.id]??layer.opacity}/>)}
    {shared&&visible[shared.id]&&<RemotePhotos map={map} layer={shared} opacity={opacity[shared.id]??shared.opacity} filters={publicFilters} onStatus={onPublicStatus}/>}
  </div>;
}
