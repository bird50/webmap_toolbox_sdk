"use client";
import {useEffect,useRef,type ComponentType} from "react";
import type {GeotaggedPhoto} from "../../core/photo-gps.js";
import {emptyPublicPhotoFilters,type PublicPhotoFilters} from "../../core/public-photo-query.js";
import type {StoredPhoto} from "../../storage/photo-storage.js";
import {useLayers,useMapAdapter,useToolbox,useToolDialog,useToolLayers,useToolState,useToolUser} from "../context.js";
import {TOOL_API_VERSION,type ToolComponentProps,type ToolPlugin,type WebmapCapability} from "../contracts.js";
import {PhotoSettings} from "../PhotoSettings.js";
import {PublicPhotoSettings} from "../PublicPhotoSettings.js";
import {PhotoTool} from "../tools/PhotoTool.js";
import {baseLayer,ownedLayer,toolLayer,type ToolLayerOptions,type ToolPluginOptions} from "./shared.js";

export const PHOTO_TOOL_ID="toolbox.photo";
export type LocalPhoto=StoredPhoto&{url:string};
export type PublicPhotoStatus={count:number;loading:boolean;error:string;hasMore:boolean};
type PhotoStore={photos:LocalPhoto[];ready:boolean;message:string;add:(photos:GeotaggedPhoto[])=>Promise<StoredPhoto[]>};
const pending:PhotoStore={photos:[],ready:false,message:"",add:async()=>[]};
const loadingStatus:PublicPhotoStatus={count:0,loading:true,error:"",hasMore:false};

/** Shared state of the photo tool, for renderers in engine-specific entries. */
export function usePhotoToolState(){
 const [store]=useToolState("photos",pending),[filters]=useToolState<PublicPhotoFilters>("filters",emptyPublicPhotoFilters),[,setStatus]=useToolState("status",loadingStatus);
 return {photos:store.photos,filters,setStatus};
}
/** Restores My Photos from browser storage every minute and when the tab becomes visible; owns their object URLs. */
function Controller(){
 const {storage}=useToolbox(),userId=useToolUser().id;
 const [,setStore]=useToolState("photos",pending);
 const mine=ownedLayer(useToolLayers(),"mine"),{registry}=useLayers(),map=useMapAdapter();
 const latest=useRef({mine,registry,map});latest.current={mine,registry,map};
 useEffect(()=>{
  let cancelled=false;const urls=new Set<string>();
  const withUrl=(record:StoredPhoto):LocalPhoto=>{const url=URL.createObjectURL(record.blob);urls.add(url);return {...record,url};};
  async function add(photos:GeotaggedPhoto[]){
   const stored=await storage.photos.savePhotos(userId,photos);
   const added=stored.map(withUrl);
   setStore(current=>({...current,photos:[...current.photos,...added]}));
   const {mine,registry,map}=latest.current;
   if(added.length){const lngs=added.map(photo=>photo.longitude),lats=added.map(photo=>photo.latitude);try{map?.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]]);}catch{/* keep the current view */}}
   if(mine)registry.setVisible(mine.id,true);
   return stored;
  }
  async function restore(){
   try{
    const result=await storage.photos.loadPhotos(userId);
    if(cancelled)return;
    const previous=[...urls];urls.clear();
    const photos=result.photos.map(withUrl);previous.forEach(url=>URL.revokeObjectURL(url));
    setStore({photos,ready:true,message:result.removed?`ลบภาพที่ครบกำหนด 15 วันแล้ว ${result.removed} รูป`:"",add});
   }catch{
    if(!cancelled)setStore(current=>({...current,add,message:"ไม่สามารถเปิดที่เก็บรูปบนเครื่องได้ กรุณาอนุญาตการจัดเก็บข้อมูลเว็บไซต์แล้วเปิดหน้าใหม่"}));
   }
  }
  void restore();
  const timer=window.setInterval(()=>void restore(),60_000);
  const onVisible=()=>{if(document.visibilityState==="visible")void restore();};
  document.addEventListener("visibilitychange",onVisible);
  return ()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();};
 },[storage,userId,setStore]);
 return null;
}
function Panel(){
 const layers=useToolLayers(),mine=ownedLayer(layers,"mine"),shared=ownedLayer(layers,"public");
 const {visible,registry}=useLayers();
 const [store]=useToolState("photos",pending),[filters]=useToolState<PublicPhotoFilters>("filters",emptyPublicPhotoFilters),[status]=useToolState("status",loadingStatus);
 const photos=useToolDialog("photos"),publicSettings=useToolDialog("public");
 const show=(layer:typeof mine,value:boolean)=>{if(layer)registry.setVisible(layer.id,value);};
 return <PhotoTool count={store.photos.length} onMyPhotoSettings={()=>photos.show()} myPhotoSettingsOpen={photos.open} layerVisible={!!mine&&!!visible[mine.id]} onLayerVisible={value=>show(mine,value)} publicVisible={!!shared&&!!visible[shared.id]} onPublicVisible={value=>show(shared,value)} publicStatus={status} onPublicSettings={trigger=>publicSettings.show(trigger)} publicSettingsOpen={publicSettings.open} filterCount={Object.values(filters).filter(Boolean).length}/>;
}
function Dialogs(){
 const shared=ownedLayer(useToolLayers(),"public"),{registry}=useLayers();
 const [store]=useToolState("photos",pending),[filters,setFilters]=useToolState<PublicPhotoFilters>("filters",emptyPublicPhotoFilters);
 const photos=useToolDialog("photos"),publicSettings=useToolDialog("public");
 return <>
  <PhotoSettings open={photos.open} onOpenChange={photos.setOpen} onAdd={store.add} storageReady={store.ready} storageMessage={store.message} savedPhotos={store.photos}/>
  <PublicPhotoSettings open={publicSettings.open} onOpenChange={publicSettings.setOpen} filters={filters} returnFocusRef={publicSettings.returnFocus} onApply={next=>{setFilters({...next});if(shared)registry.setVisible(shared.id,true);}}/>
 </>;
}
export type PhotoToolOptions=ToolPluginOptions&{mine?:ToolLayerOptions;shared?:ToolLayerOptions};
/**
 * My Photos (browser, 15 days) and Public Photos (viewport queries through the gateway). The map renderer is
 * engine-specific: use `photoTool` from `@thaiwater/toolbox-sdk/maplibre`, or pass your own Overlay here.
 */
export function createPhotoTool(Overlay:ComponentType<ToolComponentProps>,requires:readonly WebmapCapability[],{id=PHOTO_TOOL_ID,title="Photo",accessLevel="MEMBER",mine,shared}:PhotoToolOptions={}):ToolPlugin{
 return {id,title,version:"2.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires,
  layers:[
   ...toolLayer(id,"mine",{...baseLayer,id:"my-photos",title:"My Photos",description:"ภาพถ่ายที่เพิ่มในพื้นที่ปฏิบัติงานนี้",group:"ข้อมูลของฉัน",url:"local:my-photos",visible:true,color:"#8b5cf6",legend:"My Photos",popupFields:["name"],photoDataKey:"my-photos"},mine),
   ...toolLayer(id,"public",{...baseLayer,id:"public-photos",title:"Public Photos",description:"ภาพเหตุการณ์ที่เผยแพร่สาธารณะในพื้นที่แผนที่",group:"ภาพถ่ายสาธารณะ",type:"REST_API",url:"/api/public/photos",accessLevel:"PUBLIC",color:"#0284c7",legend:"Public Photos",popupFields:["eventName","username","name","capturedAt","tags"],photoDataKey:"public-photos"},shared),
  ],
  layerSettings:{public:"public"},Controller,Panel,Overlay,Dialogs};
}
