"use client";
import {useEffect} from "react";
import {bbox} from "@turf/bbox";
import type {FeatureCollection} from "geojson";
import {useDataSource,useLayers,useMapAdapter,useToolDialog,useToolLayers,useToolState,useToolText,useToolUser} from "../context.js";
import {TOOL_API_VERSION,type ToolPlugin} from "../contracts.js";
import {useDataFiles} from "../useDataFiles.js";
import {DataFilesSettings} from "../DataFilesSettings.js";
import {PublicDataFilesSettings} from "../PublicDataFilesSettings.js";
import {DataFilesTool} from "../tools/DataFilesTool.js";
import {idlePublicDataFiles,usePublicDataFiles} from "../usePublicDataFiles.js";
import {emptyPublicDataFileFilters,type PublicDataFileFilters} from "../../core/data-file-share.js";
import type {LayerDefinition} from "../../core/layers.js";
import type {GeoJSONSurface} from "../../core/map.js";
import {publicDataFilesTh} from "../messages/publicDataFiles.js";
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
 const layers=useToolLayers(),layer=ownedLayer(layers,"files"),shared=ownedLayer(layers,"public");
 // Public features follow the view while their layer is visible; the Overlay and Panel read them from tool state.
 const [filters]=useToolState<PublicDataFileFilters>("filters",emptyPublicDataFileFilters);
 const {visible}=useLayers();
 const publicData=usePublicDataFiles(shared,!!shared&&!!visible[shared.id],filters);
 const [,setPublic]=useToolState("public",idlePublicDataFiles);
 useEffect(()=>setPublic(publicData),[setPublic,publicData]);
 const t=useToolText("publicDataFiles",publicDataFilesTh);
 // Rows for the host's Data Panel: CSV columns and other file properties after the layer's popup fields.
 useDataSource(layer?{id:layer.id,title:layer.title,layerId:layer.id,features:store.data.features,columns:layer.popupFields,loading:!store.ready,error:store.error||undefined}:undefined);
 useDataSource(shared?{id:shared.id,title:shared.title,layerId:shared.id,features:publicData.data.features,columns:shared.popupFields,loading:publicData.loading,error:publicData.error?t.failed:undefined,note:publicData.message===t.hasMore?t.hasMore:undefined}:undefined);
 return null;
}
function Panel(){
 const [store]=useToolState("store",pending),[status]=useToolState("public",idlePublicDataFiles),[filters]=useToolState<PublicDataFileFilters>("filters",emptyPublicDataFileFilters);
 const layers=useToolLayers(),layer=ownedLayer(layers,"files"),shared=ownedLayer(layers,"public");
 const {visible,registry}=useLayers();
 const dialog=useToolDialog("files"),publicDialog=useToolDialog("public");
 return <DataFilesTool dataFilesCount={store.files.length} dataFilesOpen={dialog.open} onDataFilesSettings={trigger=>dialog.show(trigger)} dataFilesVisible={!!layer&&!!visible[layer.id]} onDataFilesVisible={value=>{if(layer)registry.setVisible(layer.id,value);}}
  publicLayer={shared&&{visible:!!visible[shared.id],onVisible:value=>registry.setVisible(shared.id,value),status,settingsOpen:publicDialog.open,onSettings:trigger=>publicDialog.show(trigger),filterCount:Object.values(filters).filter(Boolean).length}}/>;
}
/** Draws one owned layer through the map's GeoJSON surface, following the registry's visibility and opacity. */
function useSurfaceLayer(surface:GeoJSONSurface|undefined,layer:LayerDefinition|undefined,data:FeatureCollection){
 const {visible,opacity}=useLayers(),id=layer?.id;
 useEffect(()=>{if(!surface||!id)return;return ()=>surface.remove(id);},[surface,id]);
 useEffect(()=>{
  if(!surface||!layer)return;
  surface.set(layer.id,data,{kind:"mixed",color:layer.color,opacity:opacity[layer.id]??layer.opacity,minZoom:layer.minZoom,maxZoom:layer.maxZoom});
  surface.setVisible(layer.id,!!visible[layer.id]);
 },[surface,layer,data,visible,opacity]);
}
/** Draws the files through the map's GeoJSON surface (capability `map.geojson`), using the registry's order, visibility and opacity. */
function Overlay(){
 const map=useMapAdapter(),[store]=useToolState("store",pending),[shared]=useToolState("public",idlePublicDataFiles);
 const owned=useToolLayers(),{layers,visible}=useLayers(),surface=map?.geojson;
 useSurfaceLayer(surface,ownedLayer(owned,"files"),store.data);
 useSurfaceLayer(surface,ownedLayer(owned,"public"),shared.data);
 useEffect(()=>{surface?.order(layers.map(item=>item.id));},[surface,layers,visible]);
 return null;
}
function Dialogs(){
 const [store]=useToolState("store",pending),[filters,setFilters]=useToolState<PublicDataFileFilters>("filters",emptyPublicDataFileFilters);
 const owned=useToolLayers(),layer=ownedLayer(owned,"files"),shared=ownedLayer(owned,"public");
 const {registry}=useLayers(),map=useMapAdapter();
 const dialog=useToolDialog("files"),publicDialog=useToolDialog("public");
 return <>
  <DataFilesSettings open={dialog.open} onOpenChange={dialog.setOpen} store={store} returnFocus={dialog.returnFocus} onAdded={data=>{
   if(layer)registry.setVisible(layer.id,true);
   const [west,south,east,north]=bbox(data);
   try{map?.fitBounds([[west,south],[east,north]]);}catch{/* empty or invalid extent: keep the current view */}
  }}/>
  {shared&&<PublicDataFilesSettings open={publicDialog.open} onOpenChange={publicDialog.setOpen} filters={filters} returnFocus={publicDialog.returnFocus} onApply={next=>{setFilters({...next});registry.setVisible(shared.id,true);}}/>}
 </>;
}
/**
 * Simple Data Files: KML/GeoJSON/CSV kept in this browser for 15 days and drawn as one mixed layer; a file can be
 * published (Save & Share Public) and Public Data Files shows published files in the view through the gateway.
 */
export function dataFilesTool({id=DATA_FILES_TOOL_ID,title="Simple Data Files",accessLevel="MEMBER",layer,shared}:ToolPluginOptions&{layer?:ToolLayerOptions;shared?:ToolLayerOptions}={}):ToolPlugin{
 return {id,title,version:"2.1.0",apiVersion:TOOL_API_VERSION,accessLevel,requires:["map.geojson"],
  layers:[
   ...toolLayer(id,"files",{...baseLayer,id:"my-data-files",title:"My Data Files",description:"ไฟล์ KML, GeoJSON และ CSV ของฉัน เก็บบนเบราว์เซอร์ 15 วัน",group:"ข้อมูลของฉัน",url:"local:my-data-files",color:"#f59e0b",legend:"My Data Files",popupFields:["data_file","file_description","name","description"],render:{kind:"mixed",dataKey:"my-data-files"}},layer),
   ...toolLayer(id,"public",{...baseLayer,id:"public-data-files",title:"Public Data Files",description:"ชุดข้อมูลที่ผู้ใช้แชร์สาธารณะ ในพื้นที่แผนที่",group:"ข้อมูลสาธารณะ",type:"REST_API",url:"/api/public/data-files",accessLevel:"PUBLIC",color:"#7c3aed",legend:"Public Data Files",popupFields:["share_name","share_description","share_username","share_tags","name","description"],render:{kind:"mixed",dataKey:"public-data-files"}},shared),
  ],
  layerSettings:{files:"files",public:"public"},Controller,Panel,Overlay,Dialogs};
}
