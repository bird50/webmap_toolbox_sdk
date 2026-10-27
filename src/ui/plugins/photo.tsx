"use client";
import {photoPluginTh} from "../messages/photoPlugin.js";
import {useEffect,useMemo,useRef,type ComponentType} from "react";
import {PhotoOverlay,type MapPhoto,type PublicPhotoStatus} from "../PhotoOverlay.js";
import type {LayerDefinition} from "../../core/layers.js";
import type {GeotaggedPhoto} from "../../core/photo-gps.js";
import {emptyPublicPhotoFilters,type PublicPhotoFilters} from "../../core/public-photo-query.js";
import type {PhotoEvent,StoredPhoto} from "../../storage/photo-storage.js";
import {createPhotoStorage} from "../../storage/photo-storage.js";
import {storageName} from "../../storage/names.js";
import {useLayers,useMapAdapter,useToolId,useToolStorage,useToolDialog,useToolLayers,useToolText,useToolState,useToolUser} from "../context.js";
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
/** Photos of events added to the map (every event layer together). */
export function photosOnMap(photos:readonly LocalPhoto[],events:readonly PhotoEvent[]){
 const shown=new Set(events.filter(event=>event.onMap).flatMap(event=>event.photoIds));
 return photos.filter(photo=>shown.has(photo.id));
}
const loadingStatus:PublicPhotoStatus={count:0,loading:true,error:"",hasMore:false};
/** Layer key shared by every event layer, so the host's layer gear opens the My Photos dialog. */
export const PHOTO_EVENT_LAYER_KEY="event";
/** Registry ID of the layer that draws one event set. */
export const eventLayerId=(eventId:string)=>`my-photos/${eventId}`;
export type PhotoEventLayer={layer:LayerDefinition;event:PhotoEvent;photos:MapPhoto[]};

/**
 * Shared state of the photo tool, for renderers in engine-specific entries: one entry per event layer in registry
 * order (`events`); a photo in several sets is drawn once, by the first visible layer.
 */
export function usePhotoToolState(){
 const [store]=useToolState("photos",pending),[filters]=useToolState<PublicPhotoFilters>("filters",emptyPublicPhotoFilters),[,setStatus]=useToolState("status",loadingStatus);
 const layers=useToolLayers(),{visible}=useLayers();
 const events=useMemo(()=>{
  const drawn=new Set<string>(),result:PhotoEventLayer[]=[];
  for(const layer of layers){
   if(layer.owner?.key!==PHOTO_EVENT_LAYER_KEY)continue;
   const event=store.events.find(item=>eventLayerId(item.id)===layer.id);if(!event)continue;
   const photos=store.photos.filter(photo=>event.photoIds.includes(photo.id)&&!(visible[layer.id]&&drawn.has(photo.id))).map(photo=>({...photo,eventName:event.name}));
   if(visible[layer.id])photos.forEach(photo=>drawn.add(photo.id));
   result.push({layer,event,photos});
  }
  return result;
 },[layers,visible,store.events,store.photos]);
 return {events,photos:photosOnMap(store.photos,store.events),filters,setStatus};
}
type EventLayerTemplate=Omit<LayerDefinition,"id"|"owner"|"visible">;
/** Keeps one owned layer per event added to the map, newest first, above the tool's other layers. */
function useEventLayers(template:EventLayerTemplate|false,events:readonly PhotoEvent[],ready:boolean){
 const toolId=useToolId(),{registry}=useLayers();
 const prefix=template&&template.title;
 useEffect(()=>{
  if(!template||!ready)return;
  const owned=registry.getSnapshot().layers.filter(layer=>layer.owner?.toolId===toolId);
  const wanted=new Map(events.filter(event=>event.onMap).map(event=>[eventLayerId(event.id),event]));
  for(const layer of owned)if(layer.owner?.key===PHOTO_EVENT_LAYER_KEY&&!wanted.has(layer.id))registry.unregister(layer.id);
  const kept=registry.getSnapshot().layers.filter(layer=>layer.owner?.toolId===toolId);
  const missing=[...wanted].filter(([id])=>!kept.some(layer=>layer.id===id)).map(([id,event]):LayerDefinition=>({...template,id,title:`${prefix}/${event.name}`,legend:event.name,visible:true,owner:{toolId,key:PHOTO_EVENT_LAYER_KEY}}));
  // Events are newest first and new layers go above the existing ones, so the list matches the dialog's order.
  const above=kept.find(layer=>layer.owner?.key===PHOTO_EVENT_LAYER_KEY)??kept[0];
  if(missing.length)registry.registerOwned(toolId,missing,above?{before:above.id}:"start");
 },[template,prefix,events,ready,registry,toolId]);
}
/** Restores My Photos from browser storage every minute and when the tab becomes visible; owns their object URLs. */
function Controller({template}:{template:EventLayerTemplate|false}){
 const storage=useToolStorage("photos",appId=>createPhotoStorage(storageName(appId,"photo"))),userId=useToolUser().id;
 const [store,setStore]=useToolState("photos",pending);
 const {registry}=useLayers(),map=useMapAdapter();
 const t=useToolText("photoPlugin",photoPluginTh);
 useEventLayers(template,store.events,store.ready);
 const latest=useRef({registry,map,t,photos:()=>store.photos});latest.current={registry,map,t,photos:()=>store.photos};
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
    const {registry,map}=latest.current,photos=latest.current.photos().filter(photo=>event.photoIds.includes(photo.id));
    // A layer hidden in the layer list is shown again; a new one is registered visible by useEventLayers.
    registry.setVisible(eventLayerId(id),true);
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
 const layers=useToolLayers(),shared=ownedLayer(layers,"public");
 const {visible,registry}=useLayers();
 const [store]=useToolState("photos",pending),[filters]=useToolState<PublicPhotoFilters>("filters",emptyPublicPhotoFilters),[status]=useToolState("status",loadingStatus);
 const photos=useToolDialog("photos"),publicSettings=useToolDialog("public");
 return <PhotoTool count={store.photos.length} eventsOnMap={layers.filter(layer=>layer.owner?.key===PHOTO_EVENT_LAYER_KEY).length} onMyPhotoSettings={()=>photos.show()} myPhotoSettingsOpen={photos.open} publicVisible={!!shared&&!!visible[shared.id]} onPublicVisible={value=>{if(shared)registry.setVisible(shared.id,value);}} publicStatus={status} onPublicSettings={trigger=>publicSettings.show(trigger)} publicSettingsOpen={publicSettings.open} filterCount={Object.values(filters).filter(Boolean).length}/>;
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
/** `mine` is the template of the event layers ("My Photos/<event name>"); `false` turns them off. */
export type PhotoToolOptions=ToolPluginOptions&{mine?:ToolLayerOptions;shared?:ToolLayerOptions};
/** Engine-neutral markers and popup positioned through `MapAdapter.project`. */
function Overlay(){
 const layers=useToolLayers(),{visible,opacity}=useLayers(),{events,filters,setStatus}=usePhotoToolState();
 return <PhotoOverlay events={events} shared={ownedLayer(layers,"public")} visible={visible} opacity={opacity} publicFilters={filters} onPublicStatus={setStatus}/>;
}
/** My Photos (browser, 15 days; one layer per event set added to the map) and Public Photos (viewport queries through the gateway); `createPhotoTool` swaps the map renderer. */
export function photoTool(options?:PhotoToolOptions):ToolPlugin{return createPhotoTool(Overlay,["map.viewport","map.project","map.events"],options);}
/** Photo tool with a custom map renderer; the renderer reads shared state through `usePhotoToolState`. */
export function createPhotoTool(Overlay:ComponentType<ToolComponentProps>,requires:readonly WebmapCapability[],{id=PHOTO_TOOL_ID,title="Photo",accessLevel="MEMBER",mine,shared}:PhotoToolOptions={}):ToolPlugin{
 const [eventTemplate]=toolLayer(id,PHOTO_EVENT_LAYER_KEY,{...baseLayer,id:"my-photos",title:"My Photos",description:"ภาพในชุดเหตุการณ์ที่เก็บบนเบราว์เซอร์นี้",group:"ข้อมูลของฉัน",url:"local:my-photos",visible:true,color:"#8b5cf6",legend:"My Photos",popupFields:["name","caption"]},mine);
 const template:EventLayerTemplate|false=eventTemplate?(({id:_id,owner:_owner,visible:_visible,...rest})=>{void _id;void _owner;void _visible;return rest;})(eventTemplate):false;
 const PhotoController=()=><Controller template={template}/>;
 return {id,title,version:"3.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires,
  layers:[
   ...toolLayer(id,"public",{...baseLayer,id:"public-photos",title:"Public Photos",description:"ภาพเหตุการณ์ที่เผยแพร่สาธารณะในพื้นที่แผนที่",group:"ภาพถ่ายสาธารณะ",type:"REST_API",url:"/api/public/photos",accessLevel:"PUBLIC",color:"#0284c7",legend:"Public Photos",popupFields:["eventName","username","name","capturedAt","tags"]},shared),
  ],
  layerSettings:{public:"public",[PHOTO_EVENT_LAYER_KEY]:"photos"},Controller:PhotoController,Panel,Overlay,Dialogs};
}
