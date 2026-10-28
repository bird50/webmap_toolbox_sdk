"use client";
import {useCallback,useEffect,useMemo,useRef} from "react";
import type {Feature,Geometry} from "geojson";
import {useDataSource,useLayerRemover,useLayers,useMapAdapter,useToolbox,useToolDialog,useToolId,useToolLayers,useToolState,useToolStateOf,useToolStorage,useToolText,useToolUser} from "../../ui/context.js";
import {TOOL_API_VERSION,type ToolPlugin} from "../../ui/contracts.js";
import {DrawingWorkspace,type DrawingEdit} from "./DrawingWorkspace.js";
import {DrawingSets} from "./DrawingSets.js";
import {PublicDrawingSettings,type PublicDrawingSetRef} from "./PublicDrawingSettings.js";
import {DrawTool} from "./DrawTool.js";
import {layerTemplate,useOwnedLayers,type LayerTemplate} from "../../ui/owned-layers.js";
import {createDrawingStorage,type DrawingSet} from "./drawing-storage.js";
import {storageName} from "../../storage/names.js";
import {publicDrawingShare,type PublicDrawingSet} from "../../contracts/public-drawing-sets.js";
import type {Coordinate,Drawing} from "./drawing.js";
import type {LayerDefinition} from "../../core/layers.js";
import {drawingDataTh} from "./messages/drawingData.js";
import {baseLayer,toolLayer,type ToolLayerOptions,type ToolPluginOptions} from "../../ui/plugins/shared.js";

export const DRAW_TOOL_ID="toolbox.draw";
/** Layer key of My Drawing sets ("My Drawing/<name>") and of Public sets ("Public Drawing/<name>"). */
export const DRAWING_SET_LAYER_KEY="mine",PUBLIC_DRAWING_SET_LAYER_KEY="public";
export const drawingSetLayerId=(setId:string)=>`my-drawing/${setId}`;
export const publicDrawingSetLayerId=(shareId:string)=>`public-drawing/${shareId}`;
/** Drawing toolbar open state, readable by the host (e.g. to make room for the toolbar on small screens). */
export function useDrawingToolbar(toolId=DRAW_TOOL_ID){return useToolStateOf(toolId,"toolbar",false);}

export type DrawingSetActions={
 save:(input:{name:string;tags:string[];drawings:Drawing[]})=>Promise<DrawingSet>;
 setOnMap:(id:string,onMap:boolean)=>Promise<void>;
 setDetails:(id:string,details:{name:string;tags:string[]})=>Promise<void>;
 setDrawings:(id:string,drawings:Drawing[])=>Promise<void>;
 recordShare:(id:string,share:NonNullable<DrawingSet["share"]>)=>Promise<void>;
 remove:(id:string)=>Promise<void>;
 /** Opens the set on the Drawing Toolbar's canvas. */
 edit:(id:string)=>void;
};
type SetsStore={sets:DrawingSet[];ready:boolean;message:string;actions:DrawingSetActions};
const unavailable=async()=>{throw new Error("storage not ready");};
const pending:SetsStore={sets:[],ready:false,message:"",actions:{save:unavailable,setOnMap:unavailable,setDetails:unavailable,setDrawings:unavailable,recordShare:unavailable,remove:unavailable,edit:()=>{}}};
export type PublicDrawingSetActions={add:(set:PublicDrawingSet)=>Promise<void>;remove:(id:string)=>void};
type PublicStore={added:PublicDrawingSetRef[];drawings:Readonly<Record<string,Drawing[]>>;ready:boolean;actions:PublicDrawingSetActions};
const publicPending:PublicStore={added:[],drawings:{},ready:false,actions:{add:unavailable,remove:()=>{}}};

/** `[west,south,east,north]` of drawings, or undefined when there are none. */
function extent(drawings:readonly Drawing[]){
 const points=drawings.flatMap(d=>d.points);if(!points.length)return undefined;
 return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))] as const;
}
function useFit(){
 const map=useMapAdapter(),ref=useRef(map);ref.current=map;
 return useCallback((drawings:readonly Drawing[])=>{
  const box=extent(drawings),map=ref.current;if(!box||!map)return;
  try{if(box[0]===box[2]&&box[1]===box[3])map.navigate({longitude:box[0],latitude:box[1],zoom:Math.max(map.getZoom(),16)});else map.fitBounds([[box[0],box[1]],[box[2],box[3]]]);}catch{/* keep the current view */}
 },[]);
}
const storedSets=(key:string):PublicDrawingSetRef[]=>{
 try{const value=JSON.parse(localStorage.getItem(key)??"[]");return Array.isArray(value)?value.filter(item=>typeof item?.id==="string"&&typeof item?.name==="string").slice(0,50):[];}catch{return [];}
};
const saveSets=(key:string,sets:readonly PublicDrawingSetRef[])=>{try{localStorage.setItem(key,JSON.stringify(sets));}catch{/* the sets stay for this visit only */}};

/** My Drawing sets: loaded from this browser, one layer per set on the map, removable from the host's Layer Panel. */
function useDrawingSets(template:LayerTemplate|false){
 const storage=useToolStorage("drawings",appId=>createDrawingStorage(storageName(appId,"draw"))),userId=useToolUser().id;
 const [store,setStore]=useToolState("sets",pending),[,setEditing]=useToolState<DrawingEdit|null>("editing",null),[,setOpen]=useToolState("toolbar",false);
 const {registry}=useLayers(),fit=useFit();
 const latest=useRef({store,registry});latest.current={store,registry};
 const items=useMemo(()=>store.sets.filter(set=>set.onMap).map(set=>({id:drawingSetLayerId(set.id),name:set.name})),[store.sets]);
 useOwnedLayers(DRAWING_SET_LAYER_KEY,template,items,store.ready,true);
 useLayerRemover(DRAWING_SET_LAYER_KEY,useCallback((layerId:string)=>{void latest.current.store.actions.setOnMap(layerId.slice("my-drawing/".length),false);},[]));
 useEffect(()=>{
  let cancelled=false;
  const replace=(set:DrawingSet)=>setStore(current=>({...current,sets:current.sets.map(item=>item.id===set.id?set:item)}));
  const actions:DrawingSetActions={
   async save(input){const set=await storage.saveSet(userId,input);setStore(current=>({...current,sets:[set,...current.sets]}));return set;},
   async setOnMap(id,onMap){
    const set=await storage.updateSet(userId,id,{onMap});replace(set);
    if(!onMap)return;
    latest.current.registry.setVisible(drawingSetLayerId(id),true);fit(set.drawings);
   },
   async setDetails(id,{name,tags}){replace(await storage.updateSet(userId,id,{name,tags:[...tags]}));},
   async setDrawings(id,drawings){replace(await storage.updateSet(userId,id,{drawings}));},
   async recordShare(id,share){replace(await storage.updateSet(userId,id,{share}));},
   async remove(id){await storage.deleteSet(userId,id);setStore(current=>({...current,sets:current.sets.filter(set=>set.id!==id)}));setEditing(current=>current?.id===id?null:current);},
   edit(id){const set=latest.current.store.sets.find(item=>item.id===id);if(!set)return;setEditing({id,name:set.name,drawings:set.drawings});setOpen(true);fit(set.drawings);},
  };
  storage.loadSets(userId).then(sets=>{if(!cancelled)setStore({sets,ready:true,message:"",actions});}).catch(()=>{if(!cancelled)setStore({...pending,ready:false,message:"storage",actions});});
  return ()=>{cancelled=true;};
 },[storage,userId,setStore,setEditing,setOpen,fit]);
}
/** Public sets added to the map: IDs and names remembered in this browser per app and user, drawings read through the gateway. */
function usePublicDrawingSets(template:LayerTemplate|false){
 const {client,appId}=useToolbox(),toolId=useToolId(),userId=useToolUser().id,{registry}=useLayers(),fit=useFit();
 const [store,setStore]=useToolState("public",publicPending);
 const storageKey=`toolbox:${appId}:${toolId}:public-drawing-sets:${userId}`;
 const latest=useRef({registry,store});latest.current={registry,store};
 const items=useMemo(()=>store.added.map(set=>({id:publicDrawingSetLayerId(set.id),name:set.name})),[store.added]);
 useOwnedLayers(PUBLIC_DRAWING_SET_LAYER_KEY,template,items,store.ready,false);
 useLayerRemover(PUBLIC_DRAWING_SET_LAYER_KEY,useCallback((layerId:string)=>latest.current.store.actions.remove(layerId.slice("public-drawing/".length)),[]));
 useEffect(()=>{
  let cancelled=false;
  async function load(id:string){
   const response=await client.request("drawingShares",{cache:"no-store"},undefined,id);
   if(response.status===404)return null;
   if(!response.ok)throw new Error("Public drawing set unavailable");
   return publicDrawingShare.parse(await response.json()).drawings;
  }
  const actions:PublicDrawingSetActions={
   async add(set){
    const layerId=publicDrawingSetLayerId(set.id),current=latest.current.store;
    // Already on the map: show it again if hidden and zoom to it.
    if(current.added.some(item=>item.id===set.id)){latest.current.registry.setVisible(layerId,true);fit(current.drawings[layerId]??[]);return;}
    const drawings=await load(set.id);if(!drawings)throw new Error("Public drawing set removed");
    setStore(value=>{const added=[{id:set.id,name:set.name},...value.added.filter(item=>item.id!==set.id)];saveSets(storageKey,added);return {...value,added,drawings:{...value.drawings,[layerId]:drawings}};});
    fit(drawings);
   },
   remove(id){setStore(value=>{const added=value.added.filter(item=>item.id!==id);saveSets(storageKey,added);const drawings={...value.drawings};delete drawings[publicDrawingSetLayerId(id)];return {...value,added,drawings};});},
  };
  const added=storedSets(storageKey);
  setStore({added,drawings:{},ready:true,actions});
  void (async()=>{
   for(const set of added){
    try{
     const drawings=await load(set.id);if(cancelled)return;
     setStore(value=>{
      if(drawings)return {...value,drawings:{...value.drawings,[publicDrawingSetLayerId(set.id)]:drawings}};
      const remaining=value.added.filter(item=>item.id!==set.id);saveSets(storageKey,remaining);return {...value,added:remaining};
     });
    }catch{/* service unavailable: keep the layer, without drawings, until the next visit */}
   }
  })();
  return ()=>{cancelled=true;};
 },[client,storageKey,setStore,fit]);
}
/** Read-only drawing layers in registry order: My Drawing sets on the map (except the one being edited) and Public sets. */
export function useDrawingLayers(){
 const layers=useToolLayers(),[sets]=useToolState("sets",pending),[shared]=useToolState("public",publicPending),[editing]=useToolState<DrawingEdit|null>("editing",null);
 return useMemo(()=>layers.flatMap(layer=>{
  if(layer.owner?.key===PUBLIC_DRAWING_SET_LAYER_KEY)return [{layer,drawings:shared.drawings[layer.id]??[]}];
  const set=sets.sets.find(item=>drawingSetLayerId(item.id)===layer.id);
  return set&&set.id!==editing?.id?[{layer,drawings:set.drawings}]:[];
 }),[layers,sets.sets,shared.drawings,editing]);
}
const closed=["polygon","rectangle","circle"];
function geometry(drawing:Drawing):Geometry{
 const points=drawing.points as Coordinate[];
 if(points.length===1||["point","text","textbox","label","sticky","number","legend"].includes(drawing.tool))return {type:"Point",coordinates:points[0]};
 if(closed.includes(drawing.tool))return {type:"Polygon",coordinates:[points]};
 return {type:"LineString",coordinates:points};
}
/** One Data Panel source per drawing layer: a row per object; its type zooms to it. */
function DrawingLayerData({layer,drawings}:{layer:LayerDefinition;drawings:readonly Drawing[]}){
 const t=useToolText("drawingData",drawingDataTh),fit=useFit(),{registry}=useLayers();
 const labels=useMemo(()=>({kind:t.kind,text:t.text,set:t.set}),[t]);
 const set=layer.legend;
 const features=useMemo(()=>drawings.map((drawing):Feature=>({type:"Feature",id:drawing.id,geometry:geometry(drawing),properties:Object.fromEntries(Object.entries({kind:t.tools[drawing.tool as keyof typeof t.tools]??drawing.tool,text:drawing.text,set}).filter(([,value])=>value))})),[drawings,t,set]);
 const select=useCallback((feature:Feature)=>{const drawing=drawings.find(item=>item.id===feature.id);if(!drawing)return;registry.setVisible(layer.id,true);fit([drawing]);},[drawings,registry,layer.id,fit]);
 useDataSource({id:layer.id,title:layer.title,layerId:layer.id,features,columns:["kind","text","set"],labels,select});
 return null;
}
function Controller({mine,shared}:{mine:LayerTemplate|false;shared:LayerTemplate|false}){
 useDrawingSets(mine);
 usePublicDrawingSets(shared);
 const layers=useDrawingLayers();
 return <>{layers.map(({layer,drawings})=><DrawingLayerData key={layer.id} layer={layer} drawings={drawings}/>)}</>;
}
function Panel(){
 const layers=useToolLayers(),[open,setOpen]=useToolState("toolbar",false),[count]=useToolState("count",0),[sets]=useToolState("sets",pending);
 const mine=useToolDialog("sets"),publicDialog=useToolDialog("public");
 const onMap=(key:string)=>layers.filter(layer=>layer.owner?.key===key).length;
 return <DrawTool drawingToolbarOpen={open} onDrawingToolbarChange={setOpen} drawingCount={count} setCount={sets.sets.length} setsOnMap={onMap(DRAWING_SET_LAYER_KEY)} publicSetsOnMap={onMap(PUBLIC_DRAWING_SET_LAYER_KEY)} onSets={trigger=>mine.show(trigger)} setsOpen={mine.open} onPublic={trigger=>publicDialog.show(trigger)} publicOpen={publicDialog.open}/>;
}
/** SVG drawing overlay and toolbar; uses only the MapAdapter (viewport, projection, events). */
function Overlay(){
 const {visible,opacity}=useLayers(),layers=useDrawingLayers();
 const [open,setOpen]=useToolState("toolbar",false),[,setCount]=useToolState("count",0),[sets]=useToolState("sets",pending),[editing,setEditing]=useToolState<DrawingEdit|null>("editing",null);
 return <DrawingWorkspace userId={useToolUser().id} open={open} onClose={()=>{setOpen(false);setEditing(null);}} layers={layers} visible={visible} opacity={opacity} onCount={setCount} editing={editing}
  onSaveSet={async input=>{const set=await sets.actions.save(input);await sets.actions.setOnMap(set.id,true);}}
  onSaveEdit={async(id,drawings)=>{await sets.actions.setDrawings(id,drawings);setEditing(null);}} onCancelEdit={()=>setEditing(null)}/>;
}
function Dialogs(){
 const [sets]=useToolState("sets",pending),[shared]=useToolState("public",publicPending);
 const mine=useToolDialog("sets"),publicDialog=useToolDialog("public");
 return <>
  <DrawingSets open={mine.open} onOpenChange={mine.setOpen} returnFocusRef={mine.returnFocus} sets={sets.sets} ready={sets.ready} actions={sets.actions}/>
  <PublicDrawingSettings open={publicDialog.open} onOpenChange={publicDialog.setOpen} returnFocusRef={publicDialog.returnFocus} added={shared.added} onAdd={shared.actions.add} onRemove={shared.actions.remove}/>
 </>;
}
/**
 * My Drawing (draft and named sets in this browser, 15 days; one layer per set on the map) and Public Drawing (sets found
 * by search, one layer per set added to the map). `mine` and `shared` are the templates of those layers (`false` turns them off).
 */
export function drawTool({id=DRAW_TOOL_ID,title="Draw",accessLevel="MEMBER",mine,shared}:ToolPluginOptions&{mine?:ToolLayerOptions;shared?:ToolLayerOptions}={}):ToolPlugin{
 const [mineLayer]=toolLayer(id,DRAWING_SET_LAYER_KEY,{...baseLayer,id:"my-drawing",title:"My Drawing",description:"ชุดรูปวาดที่เก็บบนเบราว์เซอร์นี้",group:"ข้อมูลของฉัน",url:"local:my-drawing",color:"#dc2626",legend:"My Drawing",popupFields:["kind","text"]},mine);
 const [sharedLayer]=toolLayer(id,PUBLIC_DRAWING_SET_LAYER_KEY,{...baseLayer,id:"public-drawing",title:"Public Drawing",description:"ชุดรูปวาดที่แชร์สาธารณะ เพิ่มจากการค้นหาชุดรูปวาด",group:"รูปวาดสาธารณะ",url:"/api/public/drawing-shares",accessLevel:"PUBLIC",color:"#0284c7",legend:"Public Drawing",popupFields:["kind","text"]},shared);
 const templates={mine:layerTemplate(mineLayer),shared:layerTemplate(sharedLayer)};
 // Layers are registered at runtime, one per set on the map; the plugin declares none up front.
 const DrawController=()=><Controller {...templates}/>;
 return {id,title,version:"3.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires:["map.viewport","map.project","map.events"],layers:[],
  layerSettings:{[DRAWING_SET_LAYER_KEY]:"sets",[PUBLIC_DRAWING_SET_LAYER_KEY]:"public"},Controller:DrawController,Panel,Overlay,Dialogs};
}
