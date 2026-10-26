"use client";
import {publicDataFilesTh} from "./messages/publicDataFiles.js";
import {useEffect,useRef,useState} from "react";
import type {Feature,FeatureCollection} from "geojson";
import {useMapAdapter,useToolbox,useToolText} from "./context.js";
import {photoViewportBbox} from "../core/public-photo-query.js";
import {publicDataFileResponse,type PublicDataFileFilters} from "../core/data-file-share.js";
import type {LayerDefinition} from "../core/layers.js";

export type PublicDataFilesState={data:FeatureCollection;message:string;error:boolean;loading:boolean};
export const idlePublicDataFiles:PublicDataFilesState={data:{type:"FeatureCollection",features:[]},message:"",error:false,loading:false};
/** Public data file features in the current view (at most 500), reloaded after the map moves, filters change or a share is published. */
export function usePublicDataFiles(layer:LayerDefinition|undefined,visible:boolean,filters:PublicDataFileFilters){
 const map=useMapAdapter(),{client}=useToolbox();
 const t=useToolText("publicDataFiles",publicDataFilesTh);const tRef=useRef(t);tRef.current=t;
 const [state,setState]=useState(idlePublicDataFiles);
 const {search,tag}=filters;
 useEffect(()=>{
  if(!map||!visible||!layer)return;
  let disposed=false,controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>;
  async function load(){
   controller?.abort();controller=new AbortController();const active=controller;
   const bounds=map!.getBounds();if(!bounds)return;
   if(map!.getZoom()<layer!.minZoom||map!.getZoom()>=layer!.maxZoom){setState({...idlePublicDataFiles,message:tRef.current.zoomIn});return;}
   setState(current=>({...current,message:tRef.current.loading,error:false,loading:true}));
   try{
    const query=new URLSearchParams({bbox:photoViewportBbox(bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()),limit:"500"});
    if(search)query.set("search",search);if(tag)query.set("tag",tag);
    const response=await client.request("dataFiles",{cache:"no-store",signal:active.signal},query);
    if(!response.ok)throw new Error();
    const result=publicDataFileResponse.parse(await response.json());
    if(!disposed&&!active.signal.aborted)setState({data:{type:"FeatureCollection",features:result.features as Feature[]},message:result.hasMore?tRef.current.hasMore:result.features.length?tRef.current.count(result.features.length):tRef.current.empty,error:false,loading:false});
   }catch{if(!disposed&&!active.signal.aborted)setState({...idlePublicDataFiles,message:tRef.current.failed,error:true});}
  }
  function schedule(){controller?.abort();clearTimeout(timer);timer=setTimeout(()=>void load(),250);}
  map.on("load",schedule);map.on("moveend",schedule);const unsubscribe=client.subscribe("dataFiles",schedule);schedule();
  return ()=>{disposed=true;controller?.abort();clearTimeout(timer);map.off("load",schedule);map.off("moveend",schedule);unsubscribe();};
 },[map,layer,visible,client,search,tag]);
 return state;
}
