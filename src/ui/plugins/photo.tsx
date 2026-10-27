"use client";
import {photoPluginTh} from "../messages/photoPlugin.js";
import {photoDataTh} from "../messages/photoData.js";
import {useCallback,useEffect,useMemo,useRef,type ComponentType} from "react";
import type {Feature,Point} from "geojson";
import {PhotoOverlay,type MapPhoto,type PhotoFocus} from "../PhotoOverlay.js";
import type {LayerDefinition} from "../../core/layers.js";
import type {LayerPlacement} from "../../core/registry.js";
import type {GeotaggedPhoto} from "../../core/photo-gps.js";
import type {PublicPhotoSet} from "../../core/public-photo-sets.js";
import type {PhotoEvent,StoredPhoto} from "../../storage/photo-storage.js";
import {createPhotoStorage} from "../../storage/photo-storage.js";
import {storageName} from "../../storage/names.js";
import {useDataSource,useLayers,useMapAdapter,useToolbox,useToolId,useToolWorkspace,useToolStorage,useToolDialog,useToolLayers,useToolText,useToolState,useToolUser} from "../context.js";
import {TOOL_API_VERSION,type ToolComponentProps,type ToolPlugin,type WebmapCapability} from "../contracts.js";
import {PhotoSettings} from "../PhotoSettings.js";
import {PublicPhotoSettings,type PublicPhotoSetRef} from "../PublicPhotoSettings.js";
import {PhotoTool} from "../tools/PhotoTool.js";
import {baseLayer,toolLayer,type ToolLayerOptions,type ToolPluginOptions} from "./shared.js";

export const PHOTO_TOOL_ID="toolbox.photo";
export type LocalPhoto=StoredPhoto&{url:string};
export type PhotoEventActions={save:(input:{name:string;tags:string[];photoIds:string[]})=>Promise<PhotoEvent>;setOnMap:(id:string,onMap:boolean)=>Promise<void>;setPhotos:(id:string,photoIds:string[])=>Promise<void>;setCaption:(photoId:string,caption:string)=>Promise<void>;setDetails:(id:string,details:{name:string;tags:string[]})=>Promise<void>;recordShare:(id:string,share:NonNullable<PhotoEvent["share"]>)=>Promise<void>;remove:(id:string)=>Promise<void>};
type PhotoStore={photos:LocalPhoto[];events:PhotoEvent[];ready:boolean;message:string;add:(photos:(GeotaggedPhoto&{caption?:string})[])=>Promise<StoredPhoto[]>;actions:PhotoEventActions};
const unavailable=async()=>{throw new Error("storage not ready");};
const pending:PhotoStore={photos:[],events:[],ready:false,message:"",add:async()=>[],actions:{save:unavailable,setOnMap:unavailable,setPhotos:unavailable,setCaption:unavailable,setDetails:unavailable,recordShare:unavailable,remove:unavailable}};
/** Photos of events added to the map (every event layer together). */
export function photosOnMap(photos:readonly LocalPhoto[],events:readonly PhotoEvent[]){
 const shown=new Set(events.filter(event=>event.onMap).flatMap(event=>event.photoIds));
 return photos.filter(photo=>shown.has(photo.id));
}
/** Layer key shared by every event layer, so the host's layer gear opens the My Photos dialog. */
export const PHOTO_EVENT_LAYER_KEY="event";
/** Registry ID of the layer that draws one event set. */
export const eventLayerId=(eventId:string)=>`my-photos/${eventId}`;
export type PhotoEventLayer={layer:LayerDefinition;event:PhotoEvent;photos:MapPhoto[]};
/** Layer key shared by every Public set layer, so the host's layer gear opens the Public search. */
export const PUBLIC_PHOTO_SET_LAYER_KEY="set";
/** Registry ID of the layer that draws one Public set. */
export const publicSetLayerId=(shareId:string)=>`public-photos/${shareId}`;
export type PublicPhotoSetActions={add:(set:PublicPhotoSet)=>Promise<void>;remove:(id:string)=>void};
type PublicSetsStore={added:PublicPhotoSetRef[];photos:Readonly<Record<string,MapPhoto[]>>;ready:boolean;actions:PublicPhotoSetActions};
const publicPending:PublicSetsStore={added:[],photos:{},ready:false,actions:{add:unavailable,remove:()=>{}}};

/**
 * Shared state of the photo tool, for renderers in engine-specific entries: one entry per event layer in registry
 * order (`events`, a photo in several sets is drawn once, by the first visible layer), one per Public set layer
 * (`sets`), and both in registry order (`layers`).
 */
export function usePhotoToolState(){
 const [store]=useToolState("photos",pending),[shared]=useToolState("public",publicPending);
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
 const sets=useMemo(()=>layers.filter(layer=>layer.owner?.key===PUBLIC_PHOTO_SET_LAYER_KEY).map(layer=>({layer,photos:shared.photos[layer.id]??[]})),[layers,shared.photos]);
 const ordered=useMemo(()=>[...events,...sets].sort((a,b)=>layers.indexOf(a.layer)-layers.indexOf(b.layer)),[events,sets,layers]);
 return {events,sets,layers:ordered,photos:photosOnMap(store.photos,store.events)};
}
type LayerTemplate=Omit<LayerDefinition,"id"|"owner"|"visible">;
/** Where a tool with no layers yet puts its first one: inside its own block, in Toolbox order among the tools' layers. */
function blockPlacement(all:readonly LayerDefinition[],order:readonly string[],toolId:string):LayerPlacement{
 const index=order.indexOf(toolId);
 for(const id of order.slice(index+1)){const first=all.find(layer=>layer.owner?.toolId===id);if(first)return {before:first.id};}
 for(const id of order.slice(0,Math.max(index,0)).reverse()){
  const last=[...all].reverse().find(layer=>layer.owner?.toolId===id);
  if(last){const next=all[all.indexOf(last)+1];return next?{before:next.id}:"end";}
 }
 return "start";
}
/**
 * Keeps one owned layer per item under `key`, titled "<template title>/<name>". Items are newest first and new layers
 * go above the existing ones of that key; the first ones go above the tool's other layers (`first`) or below them.
 */
function useOwnedLayers(key:string,template:LayerTemplate|false,items:readonly {id:string;name:string}[],ready:boolean,first:boolean){
 const toolId=useToolId(),{registry}=useLayers(),{mounted}=useToolWorkspace();
 const order=useMemo(()=>mounted.map(plugin=>plugin.id),[mounted]);
 useEffect(()=>{
  if(!template||!ready)return;
  const wanted=new Map(items.map(item=>[item.id,item.name]));
  for(const layer of registry.getSnapshot().layers)if(layer.owner?.toolId===toolId&&layer.owner.key===key&&!wanted.has(layer.id))registry.unregister(layer.id);
  // A renamed set keeps its place, visibility and opacity under the new title.
  for(const [id,name] of wanted){
   const snapshot=registry.getSnapshot(),index=snapshot.layers.findIndex(layer=>layer.id===id),layer=snapshot.layers[index];
   if(!layer||layer.title===`${template.title}/${name}`)continue;
   const next=snapshot.layers[index+1],visible=snapshot.visible[id],opacity=snapshot.opacity[id];
   registry.unregister(id);
   registry.registerOwned(toolId,[{...layer,title:`${template.title}/${name}`,legend:name}],next?{before:next.id}:"end");
   registry.update({visible:{[id]:visible},opacity:{[id]:opacity}});
  }
  const all=registry.getSnapshot().layers,owned=all.filter(layer=>layer.owner?.toolId===toolId);
  const missing=[...wanted].filter(([id])=>!owned.some(layer=>layer.id===id)).map(([id,name]):LayerDefinition=>({...template,id,title:`${template.title}/${name}`,legend:name,visible:true,owner:{toolId,key}}));
  if(!missing.length)return;
  const same=owned.find(layer=>layer.owner?.key===key);
  const after=owned.length?all[all.indexOf(owned.at(-1)!)+1]:undefined;
  registry.registerOwned(toolId,missing,same?{before:same.id}:!owned.length?blockPlacement(all,order,toolId):first?{before:owned[0].id}:after?{before:after.id}:"end");
 },[key,template,items,ready,first,registry,toolId,order]);
}
const storedSets=(key:string):PublicPhotoSetRef[]=>{
 try{const value=JSON.parse(localStorage.getItem(key)??"[]");return Array.isArray(value)?value.filter(item=>typeof item?.id==="string"&&typeof item?.eventName==="string").slice(0,50):[];}catch{return [];}
};
const saveSets=(key:string,sets:readonly PublicPhotoSetRef[])=>{try{localStorage.setItem(key,JSON.stringify(sets));}catch{/* the sets stay for this visit only */}};
/**
 * Public sets added to the map: remembered in this browser per app and user (IDs and names only), their photos read
 * through the gateway (`GET photoShares/<id>`); a set removed from the service leaves the list.
 */
function usePublicSets(template:LayerTemplate|false){
 const {client,appId}=useToolbox(),toolId=useToolId(),userId=useToolUser().id,{registry}=useLayers(),map=useMapAdapter();
 const [store,setStore]=useToolState("public",publicPending);
 const storageKey=`toolbox:${appId}:${toolId}:public-photo-sets:${userId}`;
 const latest=useRef({registry,map,store});latest.current={registry,map,store};
 const items=useMemo(()=>store.added.map(set=>({id:publicSetLayerId(set.id),name:set.eventName})),[store.added]);
 useOwnedLayers(PUBLIC_PHOTO_SET_LAYER_KEY,template,items,store.ready,false);
 useEffect(()=>{
  let cancelled=false;
  async function load(id:string){
   const response=await client.request("photoShares",{cache:"no-store"},undefined,id);
   if(response.status===404)return null;
   if(!response.ok)throw new Error("Public set unavailable");
   const share=await response.json() as {eventName:string;tags:string[];username?:string;photos:MapPhoto[]};
   return share.photos.map(photo=>({...photo,url:client.url(photo.url),shareUrl:client.url(`/share/${id}`),eventName:share.eventName,tags:share.tags,username:share.username}));
  }
  const fit=(photos:readonly MapPhoto[])=>{if(!photos.length)return;const lngs=photos.map(photo=>photo.longitude),lats=photos.map(photo=>photo.latitude);try{latest.current.map?.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]]);}catch{/* keep the current view */}};
  const actions:PublicPhotoSetActions={
   async add(set){
    const layerId=publicSetLayerId(set.id);
    const current=latest.current.store;
    // Already on the map: show it again if hidden and zoom to it.
    if(current.added.some(item=>item.id===set.id)){latest.current.registry.setVisible(layerId,true);fit(current.photos[layerId]??[]);return;}
    const photos=await load(set.id);if(!photos)throw new Error("Public set removed");
    setStore(value=>{const added=[{id:set.id,eventName:set.eventName},...value.added.filter(item=>item.id!==set.id)];saveSets(storageKey,added);return {...value,added,photos:{...value.photos,[layerId]:photos}};});
    fit(photos);
   },
   remove(id){setStore(value=>{const added=value.added.filter(item=>item.id!==id);saveSets(storageKey,added);const photos={...value.photos};delete photos[publicSetLayerId(id)];return {...value,added,photos};});},
  };
  const added=storedSets(storageKey);
  setStore({added,photos:{},ready:true,actions});
  void (async()=>{
   for(const set of added){
    try{
     const photos=await load(set.id);if(cancelled)return;
     setStore(value=>{
      if(photos)return {...value,photos:{...value.photos,[publicSetLayerId(set.id)]:photos}};
      const remaining=value.added.filter(item=>item.id!==set.id);saveSets(storageKey,remaining);return {...value,added:remaining};
     });
    }catch{/* service unavailable: keep the layer, without photos, until the next visit */}
   }
  })();
  return ()=>{cancelled=true;};
 },[client,storageKey,setStore]);
}
const PHOTO_COLUMNS=["name","caption","capturedAt","eventName","username","tags"] as const;
/** One Data Panel source per photo layer: a row per photo; its name zooms to the photo and opens its popup. */
function PhotoLayerData({layer,photos}:{layer:LayerDefinition;photos:readonly MapPhoto[]}){
 const {registry}=useLayers(),map=useMapAdapter(),[,setFocus]=useToolState<PhotoFocus|null>("focus",null);
 const t=useToolText("photoData",photoDataTh);
 const labels=useMemo(()=>({name:t.name,caption:t.caption,capturedAt:t.capturedAt,eventName:t.eventName,username:t.username,tags:t.tags}),[t]);
 const features=useMemo(()=>photos.map((photo):Feature<Point>=>({type:"Feature",id:photo.id,geometry:{type:"Point",coordinates:[photo.longitude,photo.latitude]},properties:Object.fromEntries(Object.entries({name:photo.name,caption:photo.caption,capturedAt:photo.capturedAt?.replace("T"," "),eventName:photo.eventName,username:photo.username,tags:photo.tags?.join(", ")}).filter(([,value])=>value))})),[photos]);
 const select=useCallback((feature:Feature)=>{
  const [longitude,latitude]=(feature.geometry as Point).coordinates;
  registry.setVisible(layer.id,true);
  try{map?.navigate({longitude,latitude,zoom:Math.max(map.getZoom(),16)});}catch{/* map not ready: keep the view */}
  setFocus({layerId:layer.id,photoId:String(feature.id),at:Date.now()});
 },[registry,map,layer.id,setFocus]);
 useDataSource({id:layer.id,title:layer.title,layerId:layer.id,features,columns:PHOTO_COLUMNS,labels,select});
 return null;
}
function PhotoDataSources(){
 const {layers}=usePhotoToolState();
 return <>{layers.map(({layer,photos})=><PhotoLayerData key={layer.id} layer={layer} photos={photos}/>)}</>;
}
/** Restores My Photos from browser storage every minute and when the tab becomes visible; owns their object URLs. */
function Controller({template,publicTemplate}:{template:LayerTemplate|false;publicTemplate:LayerTemplate|false}){
 const storage=useToolStorage("photos",appId=>createPhotoStorage(storageName(appId,"photo"))),userId=useToolUser().id;
 const [store,setStore]=useToolState("photos",pending);
 const {registry}=useLayers(),map=useMapAdapter();
 const t=useToolText("photoPlugin",photoPluginTh);
 const eventItems=useMemo(()=>store.events.filter(event=>event.onMap).map(event=>({id:eventLayerId(event.id),name:event.name})),[store.events]);
 useOwnedLayers(PHOTO_EVENT_LAYER_KEY,template,eventItems,store.ready,true);
 usePublicSets(publicTemplate);
 const latest=useRef({registry,map,t,photos:()=>store.photos,events:()=>store.events});latest.current={registry,map,t,photos:()=>store.photos,events:()=>store.events};
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
  // Photos live only in sets: one left in no set is deleted from the browser.
  async function prune(candidates:readonly string[],events:readonly PhotoEvent[]){
   const orphans=candidates.filter(id=>!events.some(event=>event.photoIds.includes(id)));if(!orphans.length)return;
   await storage.deletePhotos(userId,orphans);
   setStore(current=>({...current,photos:current.photos.filter(photo=>{if(!orphans.includes(photo.id))return true;URL.revokeObjectURL(photo.url);urls.delete(photo.url);return false;})}));
  }
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
   async setPhotos(id,photoIds){
    const before=latest.current.events().find(event=>event.id===id)?.photoIds??[];
    const event=await storage.updateEvent(userId,id,{photoIds});replace(event);
    await prune(before.filter(photoId=>!photoIds.includes(photoId)),latest.current.events().map(item=>item.id===id?event:item));
   },
   async setCaption(photoId,caption){
    const {caption:next}=await storage.setCaption(userId,photoId,caption);
    setStore(current=>({...current,photos:current.photos.map(photo=>{if(photo.id!==photoId)return photo;const {caption:_old,...rest}=photo;void _old;return next?{...rest,caption:next}:rest;})}));
   },
   async setDetails(id,{name,tags}){replace(await storage.updateEvent(userId,id,{name,tags:[...tags]}));},
   async recordShare(id,share){replace(await storage.updateEvent(userId,id,{share}));},
   async remove(id){
    const removed=latest.current.events().find(event=>event.id===id);
    await storage.deleteEvent(userId,id);setStore(current=>({...current,events:current.events.filter(event=>event.id!==id)}));
    if(removed)await prune(removed.photoIds,latest.current.events().filter(event=>event.id!==id));
   },
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
 return <PhotoDataSources/>;
}
function Panel(){
 const layers=useToolLayers();
 const [store]=useToolState("photos",pending);
 const photos=useToolDialog("photos"),publicSettings=useToolDialog("public");
 const count=(key:string)=>layers.filter(layer=>layer.owner?.key===key).length;
 return <PhotoTool count={store.photos.length} eventsOnMap={count(PHOTO_EVENT_LAYER_KEY)} onMyPhotoSettings={()=>photos.show()} myPhotoSettingsOpen={photos.open} publicSetsOnMap={count(PUBLIC_PHOTO_SET_LAYER_KEY)} onPublicSettings={trigger=>publicSettings.show(trigger)} publicSettingsOpen={publicSettings.open}/>;
}
function Dialogs(){
 const [store]=useToolState("photos",pending),[shared]=useToolState("public",publicPending);
 const photos=useToolDialog("photos"),publicSettings=useToolDialog("public");
 return <>
  <PhotoSettings open={photos.open} onOpenChange={photos.setOpen} onAdd={store.add} storageReady={store.ready} storageMessage={store.message} savedPhotos={store.photos} events={store.events} eventActions={store.actions}/>
  <PublicPhotoSettings open={publicSettings.open} onOpenChange={publicSettings.setOpen} returnFocusRef={publicSettings.returnFocus} added={shared.added} onAdd={shared.actions.add} onRemove={shared.actions.remove}/>
 </>;
}
/**
 * `mine` is the template of the My Photos event layers ("My Photos/<event name>") and `shared` of the Public set layers
 * ("Public Photos/<set name>"); `false` turns either off.
 */
export type PhotoToolOptions=ToolPluginOptions&{mine?:ToolLayerOptions;shared?:ToolLayerOptions};
/** Engine-neutral markers and popup positioned through `MapAdapter.project`. */
function Overlay(){
 const {visible,opacity}=useLayers(),{layers}=usePhotoToolState(),[focus]=useToolState<PhotoFocus|null>("focus",null);
 return <PhotoOverlay layers={layers} visible={visible} opacity={opacity} focus={focus}/>;
}
/**
 * My Photos (browser, 15 days; one layer per event set added to the map) and Public Photos (sets found by search, one
 * layer per set added to the map); `createPhotoTool` swaps the map renderer.
 */
export function photoTool(options?:PhotoToolOptions):ToolPlugin{return createPhotoTool(Overlay,["map.viewport","map.project","map.events"],options);}
const template=(layer:LayerDefinition|undefined):LayerTemplate|false=>{
 if(!layer)return false;
 const {id:_id,owner:_owner,visible:_visible,...rest}=layer;void _id;void _owner;void _visible;return rest;
};
/** Photo tool with a custom map renderer; the renderer reads shared state through `usePhotoToolState`. */
export function createPhotoTool(Overlay:ComponentType<ToolComponentProps>,requires:readonly WebmapCapability[],{id=PHOTO_TOOL_ID,title="Photo",accessLevel="MEMBER",mine,shared}:PhotoToolOptions={}):ToolPlugin{
 const [eventLayer]=toolLayer(id,PHOTO_EVENT_LAYER_KEY,{...baseLayer,id:"my-photos",title:"My Photos",description:"ภาพในชุดเหตุการณ์ที่เก็บบนเบราว์เซอร์นี้",group:"ข้อมูลของฉัน",url:"local:my-photos",visible:true,color:"#8b5cf6",legend:"My Photos",popupFields:["name","caption"]},mine);
 const [setLayer]=toolLayer(id,PUBLIC_PHOTO_SET_LAYER_KEY,{...baseLayer,id:"public-photos",title:"Public Photos",description:"ชุดรูปภาพที่แชร์สาธารณะ เพิ่มจากการค้นหาชุดรูปภาพ",group:"ภาพถ่ายสาธารณะ",type:"REST_API",url:"/api/public/photo-shares",accessLevel:"PUBLIC",color:"#0284c7",legend:"Public Photos",popupFields:["eventName","username","name","capturedAt","tags","caption"]},shared);
 const events=template(eventLayer),sets=template(setLayer);
 // Layers are registered at runtime, one per set on the map; the plugin declares none up front.
 const PhotoController=()=><Controller template={events} publicTemplate={sets}/>;
 return {id,title,version:"4.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires,layers:[],
  layerSettings:{[PHOTO_EVENT_LAYER_KEY]:"photos",[PUBLIC_PHOTO_SET_LAYER_KEY]:"public"},Controller:PhotoController,Panel,Overlay,Dialogs};
}
