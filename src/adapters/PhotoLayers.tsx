"use client";

import {Marker,Popup} from "react-map-gl/maplibre";
import {useToolboxMap as useMap,useToolbox} from "../ui/context.js";
import {Camera} from "lucide-react";
import {useEffect,useState} from "react";
import {formatPhotoExpiry} from "../storage/photo-storage.js";
import {photoViewportBbox,type PublicPhotoFilters} from "../core/public-photo-query.js";
import type {LayerDefinition} from "../core/layers.js";

export type MapPhoto={id:string;name:string;url:string;longitude:number;latitude:number;expiresAt?:number;eventName?:string;username?:string;capturedAt?:string;capturedOffset?:string|null;tags?:string[];shareUrl?:string};
export type PublicPhotoStatus={count:number;loading:boolean;error:string;hasMore:boolean};

function PhotoLayerView({layer,photos,opacity}:{layer:LayerDefinition;photos:MapPhoto[];opacity:number}) {
  const [selected,setSelected]=useState<string|null>(null);
  const photo=photos.find(item=>item.id===selected);
  return <>
    {photos.map(item=><Marker key={item.id} longitude={item.longitude} latitude={item.latitude}>
      <button aria-label={`ดูภาพ ${item.name}`} title={item.eventName??item.name} className="grid size-9 place-items-center rounded-full border-2 border-white text-white shadow-lg transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-teal-600" style={{opacity,backgroundColor:layer.color}} onClick={e=>{e.stopPropagation();setSelected(item.id);}}>
        <Camera size={18} aria-hidden="true"/>
      </button>
    </Marker>)}
    {photo&&<Popup longitude={photo.longitude} latitude={photo.latitude} onClose={()=>setSelected(null)} closeOnClick={false} maxWidth="300px">
      {photo.expiresAt&&<p className="mb-2 text-[10px] text-slate-500">เก็บบนเครื่องถึง {formatPhotoExpiry(photo.expiresAt)}</p>}
      {photo.eventName&&<p className="mb-1 pr-3 text-sm font-semibold text-sky-700">{photo.eventName}</p>}
      <p className="mb-2 pr-3 text-xs font-semibold">{photo.name}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.name} className="max-h-64 w-full object-contain"/>
      {photo.username&&<p className="mt-2 text-[10px] text-slate-500">แชร์โดย {photo.username}</p>}
      {photo.capturedAt&&<p className="mt-2 text-[10px] text-slate-500">ถ่ายเมื่อ {photo.capturedAt.replace("T"," ")} {photo.capturedOffset?`UTC${photo.capturedOffset}`:"(เวลาตามกล้อง)"}</p>}
      {photo.tags&&<p className="mt-1 break-words text-[10px] text-sky-700">{photo.tags.map(tag=>`#${tag}`).join(" ")}</p>}
      {photo.shareUrl&&<a href={photo.shareUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs text-teal-700 underline">ดูชุดภาพ Public</a>}
    </Popup>}
  </>;
}

function RemotePhotoLayer({layer,opacity,onStatus,filters}:{layer:LayerDefinition;opacity:number;filters:PublicPhotoFilters;onStatus:(status:PublicPhotoStatus)=>void}) {
  const {current:map}=useMap();
  const {client}=useToolbox();
  const [photos,setPhotos]=useState<MapPhoto[]>([]);
  useEffect(()=>{
    if(!map)return;
    let controller:AbortController|undefined;
    let timer:ReturnType<typeof setTimeout>;
    let disposed=false;
    async function load(){
      controller?.abort();controller=new AbortController();const active=controller;
      const bounds=map!.getBounds();
      if(!bounds)return;
      if(map!.getZoom()<layer.minZoom||map!.getZoom()>layer.maxZoom){setPhotos([]);onStatus({count:0,loading:false,error:"",hasMore:false});return;}
      onStatus({count:0,loading:true,error:"",hasMore:false});
      try {
        const bbox=photoViewportBbox(bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth());
        const response=await client.request("photos",{signal:active.signal,cache:"no-store"},new URLSearchParams({bbox,limit:"200",...filters}));
        if(!response.ok)throw new Error("Public Photos unavailable");
        const result=await response.json() as {photos:MapPhoto[];hasMore:boolean};
        if(disposed||active.signal.aborted)return;
        setPhotos(result.photos.map(p=>({...p,url:client.url(p.url),shareUrl:p.shareUrl?client.url(p.shareUrl):undefined})));onStatus({count:result.photos.length,loading:false,error:"",hasMore:result.hasMore});
      } catch {
        if(disposed||active.signal.aborted)return;
        setPhotos([]);onStatus({count:0,loading:false,error:"โหลด Public Photos ไม่สำเร็จ ลองปิด–เปิด Layer อีกครั้ง",hasMore:false});
      }
    }
    function schedule(){controller?.abort();clearTimeout(timer);timer=setTimeout(()=>void load(),250);}
    map.on("load",schedule);map.on("moveend",schedule);const unsubscribe=client.subscribe("photos",schedule);schedule();
    return ()=>{disposed=true;controller?.abort();clearTimeout(timer);map.off("load",schedule);map.off("moveend",schedule);unsubscribe();};
  },[map,layer,onStatus,filters,client]);
  return <PhotoLayerView layer={layer} photos={photos} opacity={opacity}/>;
}

export function PhotoLayers({layers,photos,visible,opacity,onPublicStatus,publicFilters}:{layers:LayerDefinition[];photos:MapPhoto[];visible:Record<string,boolean>;opacity:Record<string,number>;onPublicStatus:(status:PublicPhotoStatus)=>void;publicFilters:PublicPhotoFilters}) {
  return layers.filter(layer=>layer.photoDataKey&&visible[layer.id]).map(layer=>layer.photoDataKey==="my-photos"
    ?<PhotoLayerView key={layer.id} layer={layer} photos={photos} opacity={opacity[layer.id]}/>
    :<RemotePhotoLayer key={layer.id} layer={layer} opacity={opacity[layer.id]} onStatus={onPublicStatus} filters={publicFilters}/>);
}
