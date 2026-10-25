"use client";
import {useEffect,useRef,useState} from "react";
import {useToolboxMap as useMap,useToolbox,useToolMessages} from "./context.js";
import {photoViewportBbox} from "../core/public-photo-query.js";
import {drawingSchema} from "../core/drawing-contract.js";
import {z} from "zod";
import type {LayerDefinition} from "../core/layers.js";
const responseSchema=z.object({drawings:z.array(drawingSchema.safeExtend({shareName:z.string(),username:z.string(),shareId:z.string()})).max(50),hasMore:z.boolean()});
export function usePublicDrawings(layer:LayerDefinition|undefined,visible:boolean){
 const {current:map}=useMap();
 const runtime=useToolbox();
 const t=useToolMessages().publicDrawings;const tRef=useRef(t);tRef.current=t;
 const [state,setState]=useState<{drawings:z.infer<typeof responseSchema>["drawings"];message:string;error:boolean}>({drawings:[],message:"",error:false});
 useEffect(()=>{
 if(!map||!visible||!layer)return;
 let disposed=false,controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>;
 async function load(){
 controller?.abort();controller=new AbortController();const active=controller;
 const bounds=map!.getBounds();if(!bounds)return;
 if(map!.getZoom()<layer!.minZoom||map!.getZoom()>=layer!.maxZoom){setState({drawings:[],message:tRef.current.zoomIn,error:false});return;}
 setState({drawings:[],message:tRef.current.loading,error:false});
 try{
 const bbox=photoViewportBbox(bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth());
 const response=await runtime.client.request("drawings",{cache:"no-store",signal:active.signal},new URLSearchParams({bbox,limit:"50"}));
 if(!response.ok)throw new Error();const result=responseSchema.parse(await response.json());
 if(!disposed&&!active.signal.aborted)setState({drawings:result.drawings,message:result.hasMore?tRef.current.hasMore:tRef.current.count(result.drawings.length),error:false});
 }catch{if(!disposed&&!active.signal.aborted)setState({drawings:[],message:tRef.current.failed,error:true});}
 }
 function schedule(){controller?.abort();clearTimeout(timer);timer=setTimeout(()=>void load(),250);}
 map.on("load",schedule);map.on("moveend",schedule);const unsubscribe=runtime.client.subscribe("drawings",schedule);schedule();
 return ()=>{disposed=true;controller?.abort();clearTimeout(timer);map.off("load",schedule);map.off("moveend",schedule);unsubscribe();};
 },[map,layer,visible,runtime.client]);
 return state;
}
