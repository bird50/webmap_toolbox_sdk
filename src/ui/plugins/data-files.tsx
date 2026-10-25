"use client";
import {useEffect} from "react";
import {bbox} from "@turf/turf";
import type {FeatureCollection} from "geojson";
import {useLayers,useMapAdapter,useToolDialog,useToolLayers,useToolState,useToolUser} from "../context.js";
import {TOOL_API_VERSION,type ToolPlugin} from "../contracts.js";
import {useDataFiles} from "../useDataFiles.js";
import {DataFilesSettings} from "../DataFilesSettings.js";
import {DataFilesTool} from "../tools/DataFilesTool.js";
import {baseLayer,ownedLayer,toolLayer,type ToolLayerOptions,type ToolPluginOptions} from "./shared.js";

export const DATA_FILES_TOOL_ID="toolbox.data-files";
type DataFilesStore=ReturnType<typeof useDataFiles>;
const empty:FeatureCollection={type:"FeatureCollection",features:[]};
const pending:DataFilesStore={files:[],ready:false,error:"",data:empty,refresh:async()=>{}};

function Controller(){
 const store=useDataFiles(useToolUser().id);
 const [,publish]=useToolState("store",pending);
 // The hook returns a fresh object each render; publish only when one of its parts changes.
 useEffect(()=>publish({files:store.files,ready:store.ready,error:store.error,data:store.data,refresh:store.refresh}),[publish,store.files,store.ready,store.error,store.data,store.refresh]);
 return null;
}
function Panel(){
 const [store]=useToolState("store",pending);
 const layer=ownedLayer(useToolLayers(),"files");
 const {visible,registry}=useLayers();
 const dialog=useToolDialog("files");
 return <DataFilesTool dataFilesCount={store.files.length} dataFilesOpen={dialog.open} onDataFilesSettings={trigger=>dialog.show(trigger)} dataFilesVisible={!!layer&&!!visible[layer.id]} onDataFilesVisible={value=>{if(layer)registry.setVisible(layer.id,value);}}/>;
}
/** Draws the files through the map's GeoJSON surface (capability `map.geojson`), using the registry's order, visibility and opacity. */
function Overlay(){
 const map=useMapAdapter(),[store]=useToolState("store",pending);
 const layer=ownedLayer(useToolLayers(),"files");
 const {layers,visible,opacity}=useLayers();
 const surface=map?.geojson,id=layer?.id;
 useEffect(()=>{if(!surface||!id)return;return ()=>surface.remove(id);},[surface,id]);
 useEffect(()=>{
  if(!surface||!layer)return;
  surface.set(layer.id,store.data,{kind:"mixed",color:layer.color,opacity:opacity[layer.id]??layer.opacity,minZoom:layer.minZoom,maxZoom:layer.maxZoom});
  surface.setVisible(layer.id,!!visible[layer.id]);
 },[surface,layer,store.data,visible,opacity]);
 useEffect(()=>{surface?.order(layers.map(item=>item.id));},[surface,layers,visible]);
 return null;
}
function Dialogs(){
 const [store]=useToolState("store",pending);
 const layer=ownedLayer(useToolLayers(),"files");
 const {registry}=useLayers(),map=useMapAdapter();
 const dialog=useToolDialog("files");
 return <DataFilesSettings open={dialog.open} onOpenChange={dialog.setOpen} store={store} returnFocus={dialog.returnFocus} onAdded={data=>{
  if(layer)registry.setVisible(layer.id,true);
  const [west,south,east,north]=bbox(data);
  try{map?.fitBounds([[west,south],[east,north]]);}catch{/* empty or invalid extent: keep the current view */}
 }}/>;
}
/** Simple Data Files: KML/GeoJSON/CSV kept in this browser for 15 days and drawn as one mixed layer. */
export function dataFilesTool({id=DATA_FILES_TOOL_ID,title="Simple Data Files",accessLevel="MEMBER",layer}:ToolPluginOptions&{layer?:ToolLayerOptions}={}):ToolPlugin{
 return {id,title,version:"2.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires:["map.geojson"],
  layers:toolLayer(id,"files",{...baseLayer,id:"my-data-files",title:"My Data Files",description:"ไฟล์ KML, GeoJSON และ CSV ของฉัน เก็บบนเบราว์เซอร์ 15 วัน",group:"ข้อมูลของฉัน",url:"local:my-data-files",color:"#f59e0b",legend:"My Data Files",popupFields:["data_file","file_description","name","description"],render:{kind:"mixed",dataKey:"my-data-files"}},layer),
  layerSettings:{files:"files"},Controller,Panel,Overlay,Dialogs};
}
