"use client";
import {useCallback,useEffect,useMemo,useRef} from "react";
import {bbox} from "@turf/bbox";
import type {FeatureCollection} from "geojson";
import {useDataSource,useLayerRemover,useLayers,useMapAdapter,useToolbox,useToolDialog,useToolId,useToolLayers,useToolState,useToolText,useToolUser} from "../../ui/context.js";
import {TOOL_API_VERSION,type ToolPlugin} from "../../ui/contracts.js";
import {useDataFiles} from "./useDataFiles.js";
import {DataFilesSettings} from "./DataFilesSettings.js";
import {PublicDataFilesSettings,type PublicDataFileSetRef} from "./PublicDataFilesSettings.js";
import {DataFilesTool} from "./DataFilesTool.js";
import {layerTemplate,useOwnedLayers,type LayerTemplate} from "../../ui/owned-layers.js";
import {publicDataFileShare,type PublicDataFileSet,type PublicDataFileShare} from "../../contracts/public-data-file-sets.js";
import type {LayerDefinition} from "../../core/layers.js";
import type {GeoJSONSurface} from "../../core/map.js";
import type {DataFilePatch,StoredDataFile} from "./data-file-storage.js";
import {dataFilesDataTh} from "./messages/dataFilesData.js";
import {baseLayer,toolLayer,type ToolLayerOptions,type ToolPluginOptions} from "../../ui/plugins/shared.js";

export const DATA_FILES_TOOL_ID="toolbox.data-files";
/** Layer key of My Data Files sets ("My Data Files/<name>") and of Public sets ("Public Data Files/<name>"). */
export const DATA_FILE_SET_LAYER_KEY="file",PUBLIC_DATA_FILE_SET_LAYER_KEY="public";
export const dataFileSetLayerId=(setId:string)=>`my-data-files/${setId}`;
export const publicDataFileSetLayerId=(shareId:string)=>`public-data-files/${shareId}`;

export type DataFileSetActions={
 /** Saves a new set and adds it to the map. */
 add:(input:{name:string;description:string;tags:string[];data:FeatureCollection})=>Promise<StoredDataFile>;
 setOnMap:(id:string,onMap:boolean)=>Promise<void>;
 setDetails:(id:string,details:{name:string;description:string;tags:string[];data?:FeatureCollection})=>Promise<void>;
 recordShare:(id:string,share:NonNullable<StoredDataFile["share"]>)=>Promise<void>;
 remove:(id:string)=>Promise<void>;
 retry:()=>Promise<void>;
};
type SetsStore={files:StoredDataFile[];ready:boolean;error:string;actions:DataFileSetActions};
const unavailable=async()=>{throw new Error("storage not ready");};
const pending:SetsStore={files:[],ready:false,error:"",actions:{add:unavailable,setOnMap:unavailable,setDetails:unavailable,recordShare:unavailable,remove:unavailable,retry:unavailable}};
export type PublicDataFileSetActions={add:(set:PublicDataFileSet)=>Promise<void>;remove:(id:string)=>void};
type PublicStore={added:PublicDataFileSetRef[];shares:Readonly<Record<string,PublicDataFileShare>>;ready:boolean;actions:PublicDataFileSetActions};
const publicPending:PublicStore={added:[],shares:{},ready:false,actions:{add:unavailable,remove:()=>{}}};
const empty:FeatureCollection={type:"FeatureCollection",features:[]};

function useFit(){
 const map=useMapAdapter(),ref=useRef(map);ref.current=map;
 return useCallback((data:FeatureCollection)=>{
  const map=ref.current;if(!map||!data.features.length)return;
  const [west,south,east,north]=bbox(data);
  try{if(west===east&&south===north)map.navigate({longitude:west,latitude:south,zoom:Math.max(map.getZoom(),14)});else map.fitBounds([[west,south],[east,north]]);}catch{/* invalid extent: keep the current view */}
 },[]);
}
const storedSets=(key:string):PublicDataFileSetRef[]=>{
 try{const value=JSON.parse(localStorage.getItem(key)??"[]");return Array.isArray(value)?value.filter(item=>typeof item?.id==="string"&&typeof item?.name==="string").slice(0,50):[];}catch{return [];}
};
const saveSets=(key:string,sets:readonly PublicDataFileSetRef[])=>{try{localStorage.setItem(key,JSON.stringify(sets));}catch{/* the sets stay for this visit only */}};

/** My Data Files sets: loaded from this browser, one layer per set on the map, removable from the host's Layer Panel. */
function useDataFileSets(template:LayerTemplate|false){
 const userId=useToolUser().id,{files,ready,error,refresh}=useDataFiles(userId);
 const [store,setStore]=useToolState("sets",pending);
 const {registry}=useLayers(),fit=useFit();
 const latest=useRef(registry);latest.current=registry;
 const items=useMemo(()=>files.filter(file=>file.onMap).map(file=>({id:dataFileSetLayerId(file.id),name:file.name})),[files]);
 useOwnedLayers(DATA_FILE_SET_LAYER_KEY,template,items,ready,true);
 const actions=useMemo<DataFileSetActions>(()=>{
  const update=async(id:string,patch:DataFilePatch)=>{const saved=await refresh({update:{id,patch}});return saved.find(file=>file.id===id)!;};
  return {
   async add(input){
    const id=crypto.randomUUID(),saved=await refresh({add:{...input,id,onMap:true}}),set=saved.find(file=>file.id===id)!;
    latest.current.setVisible(dataFileSetLayerId(id),true);fit(set.data);return set;
   },
   async setOnMap(id,onMap){
    const set=await update(id,{onMap});
    if(onMap){latest.current.setVisible(dataFileSetLayerId(id),true);fit(set.data);}
   },
   async setDetails(id,details){await update(id,{...details,tags:[...details.tags]});},
   async recordShare(id,share){await update(id,{share});},
   async remove(id){await refresh({remove:id});},
   async retry(){await refresh();},
  };
 },[refresh,fit]);
 useLayerRemover(DATA_FILE_SET_LAYER_KEY,useCallback((layerId:string)=>{void actions.setOnMap(layerId.slice("my-data-files/".length),false).catch(()=>{});},[actions]));
 useEffect(()=>setStore({files,ready,error,actions}),[setStore,files,ready,error,actions]);
 return store;
}
/** Public sets added to the map: IDs and names remembered in this browser per app and user, features read through the gateway. */
function usePublicDataFileSets(template:LayerTemplate|false){
 const {client,appId}=useToolbox(),toolId=useToolId(),userId=useToolUser().id,{registry}=useLayers(),fit=useFit();
 const [store,setStore]=useToolState("public",publicPending);
 const storageKey=`toolbox:${appId}:${toolId}:public-data-file-sets:${userId}`;
 const latest=useRef({registry,store});latest.current={registry,store};
 const items=useMemo(()=>store.added.map(set=>({id:publicDataFileSetLayerId(set.id),name:set.name})),[store.added]);
 useOwnedLayers(PUBLIC_DATA_FILE_SET_LAYER_KEY,template,items,store.ready,false);
 useLayerRemover(PUBLIC_DATA_FILE_SET_LAYER_KEY,useCallback((layerId:string)=>latest.current.store.actions.remove(layerId.slice("public-data-files/".length)),[]));
 useEffect(()=>{
  let cancelled=false;
  async function load(id:string){
   const response=await client.request("dataFileShares",{cache:"no-store"},undefined,id);
   if(response.status===404)return null;
   if(!response.ok)throw new Error("Public data file set unavailable");
   return publicDataFileShare.parse(await response.json());
  }
  const actions:PublicDataFileSetActions={
   async add(set){
    const layerId=publicDataFileSetLayerId(set.id),current=latest.current.store;
    // Already on the map: show it again if hidden and zoom to it.
    if(current.added.some(item=>item.id===set.id)){latest.current.registry.setVisible(layerId,true);const shown=current.shares[layerId];if(shown)fit(shown.data as FeatureCollection);return;}
    const share=await load(set.id);if(!share)throw new Error("Public data file set removed");
    setStore(value=>{const added=[{id:set.id,name:set.name},...value.added.filter(item=>item.id!==set.id)];saveSets(storageKey,added);return {...value,added,shares:{...value.shares,[layerId]:share}};});
    fit(share.data as FeatureCollection);
   },
   remove(id){setStore(value=>{const added=value.added.filter(item=>item.id!==id);saveSets(storageKey,added);const shares={...value.shares};delete shares[publicDataFileSetLayerId(id)];return {...value,added,shares};});},
  };
  const added=storedSets(storageKey);
  setStore({added,shares:{},ready:true,actions});
  void (async()=>{
   for(const set of added){
    try{
     const share=await load(set.id);if(cancelled)return;
     setStore(value=>{
      if(share)return {...value,shares:{...value.shares,[publicDataFileSetLayerId(set.id)]:share}};
      const remaining=value.added.filter(item=>item.id!==set.id);saveSets(storageKey,remaining);return {...value,added:remaining};
     });
    }catch{/* service unavailable: keep the layer, without features, until the next visit */}
   }
  })();
  return ()=>{cancelled=true;};
 },[client,storageKey,setStore,fit]);
}
/**
 * Data file layers in registry order with their features: set properties are added to each feature (`data_file`,
 * `file_description` for My Data Files; `share_*` for Public sets) for popups and the Data Panel.
 */
export function useDataFileLayers(){
 const layers=useToolLayers(),[sets]=useToolState("sets",pending),[shared]=useToolState("public",publicPending);
 return useMemo(()=>layers.flatMap(layer=>{
  if(layer.owner?.key===PUBLIC_DATA_FILE_SET_LAYER_KEY){
   const share=shared.shares[layer.id];
   const data:FeatureCollection=share?{type:"FeatureCollection",features:(share.data as FeatureCollection).features.map(feature=>({...feature,properties:{...feature.properties,share_name:share.name,share_description:share.description,share_username:share.username,share_tags:share.tags.join(", "),share_id:share.id}}))}:empty;
   return [{layer,data}];
  }
  const set=sets.files.find(file=>dataFileSetLayerId(file.id)===layer.id);
  return set?[{layer,data:{type:"FeatureCollection",features:set.data.features.map(feature=>({...feature,properties:{...feature.properties,data_file:set.name,file_description:set.description}}))} as FeatureCollection}]:[];
 }),[layers,sets.files,shared.shares]);
}
/** One Data Panel source per data file layer: the layer's popup fields first, then the file's other columns. */
function DataFileLayerData({layer,data,loading,error}:{layer:LayerDefinition;data:FeatureCollection;loading:boolean;error?:string}){
 const t=useToolText("dataFilesData",dataFilesDataTh);
 useDataSource({id:layer.id,title:layer.title,layerId:layer.id,features:data.features,columns:layer.popupFields,labels:t.labels,loading,error});
 return null;
}
function Controller({mine,shared}:{mine:LayerTemplate|false;shared:LayerTemplate|false}){
 const sets=useDataFileSets(mine);
 usePublicDataFileSets(shared);
 const layers=useDataFileLayers();
 return <>{layers.map(({layer,data})=><DataFileLayerData key={layer.id} layer={layer} data={data} loading={layer.owner?.key===DATA_FILE_SET_LAYER_KEY&&!sets.ready} error={layer.owner?.key===DATA_FILE_SET_LAYER_KEY?sets.error||undefined:undefined}/>)}</>;
}
function Panel({publicSets}:{publicSets:boolean}){
 const layers=useToolLayers(),[sets]=useToolState("sets",pending);
 const mine=useToolDialog("files"),publicDialog=useToolDialog("public");
 const onMap=(key:string)=>layers.filter(layer=>layer.owner?.key===key).length;
 return <DataFilesTool setCount={sets.files.length} setsOnMap={onMap(DATA_FILE_SET_LAYER_KEY)} onSets={trigger=>mine.show(trigger)} setsOpen={mine.open}
  {...publicSets?{publicSetsOnMap:onMap(PUBLIC_DATA_FILE_SET_LAYER_KEY),onPublic:(trigger:HTMLButtonElement)=>publicDialog.show(trigger),publicOpen:publicDialog.open}:{}}/>;
}
/** Draws one owned layer through the map's GeoJSON surface, following the registry's visibility and opacity. */
function SurfaceLayer({surface,layer,data}:{surface:GeoJSONSurface;layer:LayerDefinition;data:FeatureCollection}){
 const {visible,opacity}=useLayers(),id=layer.id;
 useEffect(()=>()=>surface.remove(id),[surface,id]);
 useEffect(()=>{
  surface.set(layer.id,data,{kind:"mixed",color:layer.color,opacity:opacity[layer.id]??layer.opacity,minZoom:layer.minZoom,maxZoom:layer.maxZoom});
  surface.setVisible(layer.id,!!visible[layer.id]);
 },[surface,layer,data,visible,opacity]);
 return null;
}
/** Draws each set through the map's GeoJSON surface (capability `map.geojson`), using the registry's order, visibility and opacity. */
function Overlay(){
 const map=useMapAdapter(),surface=map?.geojson,{layers,visible}=useLayers(),owned=useDataFileLayers();
 useEffect(()=>{surface?.order(layers.map(item=>item.id));},[surface,layers,visible,owned]);
 return surface?<>{owned.map(({layer,data})=><SurfaceLayer key={layer.id} surface={surface} layer={layer} data={data}/>)}</>:null;
}
function Dialogs({publicSets}:{publicSets:boolean}){
 const [sets]=useToolState("sets",pending),[shared]=useToolState("public",publicPending);
 const mine=useToolDialog("files"),publicDialog=useToolDialog("public");
 return <>
  <DataFilesSettings open={mine.open} onOpenChange={mine.setOpen} returnFocusRef={mine.returnFocus} files={sets.files} ready={sets.ready} error={sets.error} actions={sets.actions}/>
  {publicSets&&<PublicDataFilesSettings open={publicDialog.open} onOpenChange={publicDialog.setOpen} returnFocusRef={publicDialog.returnFocus} added={shared.added} onAdd={shared.actions.add} onRemove={shared.actions.remove}/>}
 </>;
}
/**
 * Simple Data Files: KML/GeoJSON/CSV saved as named sets in this browser for 15 days, one layer per set on the map, each
 * set saved to Public once; Public Data Files are sets found by search, one layer per set added to the map. `layer` and
 * `shared` are the templates of those layers (`false` turns them off).
 */
export function dataFilesTool({id=DATA_FILES_TOOL_ID,title="Simple Data Files",accessLevel="MEMBER",layer,shared}:ToolPluginOptions&{layer?:ToolLayerOptions;shared?:ToolLayerOptions}={}):ToolPlugin{
 const [mineLayer]=toolLayer(id,DATA_FILE_SET_LAYER_KEY,{...baseLayer,id:"my-data-files",title:"My Data Files",description:"ชุดข้อมูลจากไฟล์ KML, GeoJSON และ CSV ของฉัน เก็บบนเบราว์เซอร์ 15 วัน",group:"ข้อมูลของฉัน",url:"local:my-data-files",color:"#f59e0b",legend:"My Data Files",popupFields:["data_file","file_description","name","description"],render:{kind:"mixed",dataKey:"my-data-files"}},layer);
 const [sharedLayer]=toolLayer(id,PUBLIC_DATA_FILE_SET_LAYER_KEY,{...baseLayer,id:"public-data-files",title:"Public Data Files",description:"ชุดข้อมูลที่ผู้ใช้แชร์สาธารณะ เพิ่มจากการค้นหาชุดข้อมูล",group:"ข้อมูลสาธารณะ",url:"/api/public/data-file-shares",accessLevel:"PUBLIC",color:"#7c3aed",legend:"Public Data Files",popupFields:["share_name","share_description","share_username","share_tags","name","description"],render:{kind:"mixed",dataKey:"public-data-files"}},shared);
 const templates={mine:layerTemplate(mineLayer),shared:layerTemplate(sharedLayer)},publicSets=!!templates.shared;
 // Layers are registered at runtime, one per set on the map; the plugin declares none up front.
 const FilesController=()=><Controller {...templates}/>;
 return {id,title,version:"3.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires:["map.geojson"],layers:[],
  layerSettings:{[DATA_FILE_SET_LAYER_KEY]:"files",[PUBLIC_DATA_FILE_SET_LAYER_KEY]:"public"},Controller:FilesController,Panel:()=><Panel publicSets={publicSets}/>,Overlay,Dialogs:()=><Dialogs publicSets={publicSets}/>};
}
