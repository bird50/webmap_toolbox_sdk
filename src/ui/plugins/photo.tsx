"use client";
import {photoPluginTh} from "../messages/photoPlugin.js";
import {useEffect,useRef,type ComponentType} from "react";
import {PhotoOverlay,type PublicPhotoStatus} from "../PhotoOverlay.js";
import type {GeotaggedPhoto} from "../../core/photo-gps.js";
import {emptyPublicPhotoFilters,type PublicPhotoFilters} from "../../core/public-photo-query.js";
import type {PhotoEvent,StoredPhoto} from "../../storage/photo-storage.js";
import {createPhotoStorage} from "../../storage/photo-storage.js";
import {storageName} from "../../storage/names.js";
import {useLayers,useMapAdapter,useToolStorage,useToolDialog,useToolLayers,useToolText,useToolState,useToolUser} from "../context.js";
import {TOOL_API_VERSION,type ToolComponentProps,type ToolPlugin,type WebmapCapability} from "../contracts.js";
import {PhotoSettings} from "../PhotoSettings.js";
import {PublicPhotoSettings} from "../PublicPhotoSettings.js";
import {PhotoTool} from "../tools/PhotoTool.js";
import {baseLayer,ownedLayer,toolLayer,type ToolLayerOptions,type ToolPluginOptions} from "./shared.js";

export const PHOTO_TOOL_ID="toolbox.photo";
export type LocalPhoto=StoredPhoto&{url:string};
export type PhotoEventActions={save:(input:{name:string;tags:string[];photoIds:string[]})=>Promise<PhotoEvent>;setOnMap:(id:string,onMap:boolean)=>Promise<void>;setPhotos:(id:string,photoIds:string[])=>Promise<void>;setCaption:(photoId:string,caption:string)=>Promise<void>;recordShare:(id:string,share:NonNullable<PhotoEvent["share"]>)=>Promise<void>;remove:(id:string)=>Promise<void>};
type PhotoStore={photos:LocalPhoto[];events:PhotoEvent[];ready:boolean;message:string;add:(photos:(GeotaggedPhoto&{caption?:string})[])=>Promise<StoredPhoto[]>;actions:PhotoEventActions};
const unavailable=async()=>{throw new Error("storage not ready");};
const pending:PhotoStore={photos:[],events:[],ready:false,message:"",add:async()=>[],actions:{save:unavailable,setOnMap:unavailable,setPhotos:unavailable,setCaption:unavailable,recordShare:unavailable,remove:unavailable}};
/** Photos of events added to the map: what the My Photos layer draws. */
export function photosOnMap(photos:readonly LocalPhoto[],events:readonly PhotoEvent[]){
 const shown=new Set(events.filter(event=>event.onMap).flatMap(event=>event.photoIds));
 return photos.filter(photo=>shown.has(photo.id));
}
const loadingStatus:PublicPhotoStatus={count:0,loading:true,error:"",hasMore:false};

/** Shared state of the photo tool, for renderers in engine-specific entries. */
export function usePhotoToolState(){
 const [store]=useToolState("photos",pending),[filters]=useToolState<PublicPhotoFilters>("filters",emptyPublicPhotoFilters),[,setStatus]=useToolState("status",loadingStatus);
 return {photos:photosOnMap(store.photos,store.events),filters,setStatus};
}
/** Restores My Photos from browser storage every minute and when the tab becomes visible; owns their object URLs. */
function Controller(){
 const storage=useToolStorage("photos",appId=>createPhotoStorage(storageName(appId,"photo"))),userId=useToolUser().id;
 const [store,setStore]=useToolState("photos",pending);
 const mine=ownedLayer(useToolLayers(),"mine"),{registry}=useLayers(),map=useMapAdapter();
 const t=useToolText("photoPlugin",photoPluginTh);
 const latest=useRef({mine,registry,map,t,photos:()=>store.photos});latest.current={mine,registry,map,t,photos:()=>store.photos};
 useEffect(()=>{
  let cancelled=false;const urls=new Set<string>();
  const withUrl=(record:StoredPhoto):LocalPhoto=>{const url=URL.createObjectURL(record.blob);urls.add(url);return {...record,url};};
  // New photos join My Photos only; they reach the map through an event set that is added to it.
  async function add(photos:(GeotaggedPhoto&{caption?:string})[]){
   const stored=await storage.savePhotos(userId,photos);
   const added=stored.map(withUrl);
   setStore(current=>({...current,photos:[...current.photos,...added]}));
   return stored;
  }
  const replace=(event:PhotoEvent)=>setStore(current=>({...current,events:current.events.map(item=>item.id===event.id?event:item)}));
  const actions:PhotoEventActions={
   async save(input){const event=await storage.saveEvent(userId,input);setStore(current=>({...current,events:[event,...current.events]}));return event;},
   async setOnMap(id,onMap){
    const event=await storage.updateEvent(userId,id,{onMap});replace(event);
    if(!onMap)return;
    const {mine,registry,map}=latest.current,photos=latest.current.photos().filter(photo=>event.photoIds.includes(photo.id));
    if(mine)registry.setVisible(mine.id,true);
    if(photos.length){const lngs=photos.map(photo=>photo.longitude),lats=photos.map(photo=>photo.latitude);try{map?.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]]);}catch{/* keep the current view */}}
   },
   async setPhotos(id,photoIds){replace(await storage.updateEvent(userId,id,{photoIds}));},
   async setCaption(photoId,caption){
    const {caption:next}=await storage.setCaption(userId,photoId,caption);
    setStore(current=>({...current,photos:current.photos.map(photo=>{if(photo.id!==photoId)return photo;const {caption:_old,...rest}=photo;void _old;return next?{...rest,caption:next}:rest;})}));
   },
   async recordShare(id,share){replace(await storage.updateEvent(userId,id,{share}));},
   async remove(id){await storage.deleteEvent(userId,id);setStore(current=>({...current,events:current.events.filter(event=>event.id!==id)}));},
  };
  async function restore(){
   try{
    const result=await storage.loadPhotos(userId);
    if(cancelled)return;
    const previous=[...urls];urls.clear();
    const photos=result.photos.map(withUrl);previous.forEach(url=>URL.revokeObjectURL(url));
    setStore({photos,events:result.events,ready:true,message:result.removed?latest.current.t.expired(result.removed):"",add,actions});
   }catch{
    if(!cancelled)setStore(current=>({...current,add,actions,message:latest.current.t.storageUnavailable}));
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
  <PhotoSettings open={photos.open} onOpenChange={photos.setOpen} onAdd={store.add} storageReady={store.ready} storageMessage={store.message} savedPhotos={store.photos} events={store.events} eventActions={store.actions}/>
  <PublicPhotoSettings open={publicSettings.open} onOpenChange={publicSettings.setOpen} filters={filters} returnFocusRef={publicSettings.returnFocus} onApply={next=>{setFilters({...next});if(shared)registry.setVisible(shared.id,true);}}/>
 </>;
}
export type PhotoToolOptions=ToolPluginOptions&{mine?:ToolLayerOptions;shared?:ToolLayerOptions};
/** Engine-neutral markers and popup positioned through `MapAdapter.project`. */
function Overlay(){
 const layers=useToolLayers(),{visible,opacity}=useLayers(),{photos,filters,setStatus}=usePhotoToolState();
 return <PhotoOverlay mine={ownedLayer(layers,"mine")} shared={ownedLayer(layers,"public")} photos={photos} visible={visible} opacity={opacity} publicFilters={filters} onPublicStatus={setStatus}/>;
}
/** My Photos (browser, 15 days) and Public Photos (viewport queries through the gateway); `createPhotoTool` swaps the map renderer. */
export function photoTool(options?:PhotoToolOptions):ToolPlugin{return createPhotoTool(Overlay,["map.viewport","map.project","map.events"],options);}
/** Photo tool with a custom map renderer; the renderer reads shared state through `usePhotoToolState`. */
export function createPhotoTool(Overlay:ComponentType<ToolComponentProps>,requires:readonly WebmapCapability[],{id=PHOTO_TOOL_ID,title="Photo",accessLevel="MEMBER",mine,shared}:PhotoToolOptions={}):ToolPlugin{
 return {id,title,version:"2.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires,
  layers:[
   ...toolLayer(id,"mine",{...baseLayer,id:"my-photos",title:"My Photos",description:"ภาพถ่ายที่เพิ่มในพื้นที่ปฏิบัติงานนี้",group:"ข้อมูลของฉัน",url:"local:my-photos",visible:true,color:"#8b5cf6",legend:"My Photos",popupFields:["name"]},mine),
   ...toolLayer(id,"public",{...baseLayer,id:"public-photos",title:"Public Photos",description:"ภาพเหตุการณ์ที่เผยแพร่สาธารณะในพื้นที่แผนที่",group:"ภาพถ่ายสาธารณะ",type:"REST_API",url:"/api/public/photos",accessLevel:"PUBLIC",color:"#0284c7",legend:"Public Photos",popupFields:["eventName","username","name","capturedAt","tags"]},shared),
  ],
  layerSettings:{public:"public"},Controller,Panel,Overlay,Dialogs};
}
