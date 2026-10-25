"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import type {MapAdapter} from '../core/map.js';
import type {PublicClient} from '../core/client.js';
import type {LayerDefinition} from '../core/layers.js';
import {createLayerRegistry,type LayerRegistry} from '../core/registry.js';
import {createToolWorkspaceStore,registerPluginLayers,type StateUpdate,type ToolUser,type ToolWorkspaceStore} from '../core/workspace.js';
import type {BrowserStorage} from '../storage/index.js';
import {TOOL_API_VERSION,definePlugins,mapCapabilities,pluginAvailable,type ToolPlugin,type WebmapCapability} from './contracts.js';
import {thMessages,type ToolboxMessages} from './messages.js';
import {ToolBoundary} from './boundary.js';
export type ToolboxRuntime={appId:string;storage:BrowserStorage;client:PublicClient};
type Workspace={store:ToolWorkspaceStore;registry:LayerRegistry;user:ToolUser;messages:ToolboxMessages;plugins:readonly ToolPlugin[];mounted:readonly ToolPlugin[];failed:Readonly<Record<string,string>>};
const Context=createContext<ToolboxRuntime|null>(null);
const MapContext=createContext<MapAdapter|null>(null);
const WorkspaceContext=createContext<Workspace|null>(null);
const ToolContext=createContext<string|null>(null);
const guest:ToolUser={id:'guest',accessLevel:'PUBLIC'};
const noPlugins:readonly ToolPlugin[]=[];
const noCapabilities:readonly WebmapCapability[]=[];

/**
 * `runtime` alone keeps the Host API 1.0 behaviour. Tool API 2.0 adds `plugins`, the shared `registry`
 * (one is created when omitted), `user`, extra host `capabilities`, `messages`, and where tool layers enter the list.
 * Keep `plugins`, `registry` and `messages` stable; remount the provider (e.g. `key={user.id}`) when the user changes.
 * Tools requiring map capabilities mount once a map adapter is attached (`map` here or a MapAdapterProvider/bridge below).
 */
export function ToolboxProvider({runtime,children,plugins=noPlugins,registry,user=guest,map,capabilities=noCapabilities,messages,toolLayers='end'}:{runtime:ToolboxRuntime;children:ReactNode;plugins?:readonly ToolPlugin[];registry?:LayerRegistry;user?:ToolUser;map?:MapAdapter;capabilities?:readonly WebmapCapability[];messages?:Partial<ToolboxMessages>;toolLayers?:'start'|'end'}){
 const [store]=useState(createToolWorkspaceStore);
 const [fallbackRegistry]=useState(()=>registry?undefined:createLayerRegistry([],user.accessLevel));
 const layers=registry??fallbackRegistry!;
 const checked=useMemo(()=>definePlugins(plugins),[plugins]);
 useEffect(()=>{if(!map)return;store.attachMap(map);return ()=>store.detachMap(map);},[store,map]);
 const attached=useSyncExternalStore(store.subscribeMap,store.getMap,store.getMap);
 const capabilityKey=[...new Set<WebmapCapability>(['layers.control','layers.register',...(attached?['map.navigate' as const,...mapCapabilities(attached)]:[]),...capabilities])].sort().join(' ');
 const available=useMemo(()=>{const environment={apiVersion:TOOL_API_VERSION,accessLevel:user.accessLevel,capabilities:capabilityKey.split(' ') as WebmapCapability[]};return checked.filter(plugin=>pluginAvailable(plugin,environment));},[checked,user.accessLevel,capabilityKey]);
 const [failed,setFailed]=useState<Record<string,string>>({});
 const latest=useRef(available);latest.current=available;
 const availableKey=available.map(plugin=>plugin.id).join('\n');
 useEffect(()=>{
  const result=registerPluginLayers(layers,latest.current,toolLayers);
  setFailed(current=>JSON.stringify(current)===JSON.stringify(result.failed)?current:result.failed);
  return ()=>result.dispose();
 },[layers,availableKey,toolLayers]);
 const workspace=useMemo<Workspace>(()=>({store,registry:layers,user:{id:user.id,accessLevel:user.accessLevel},messages:{...thMessages,...messages},plugins:checked,mounted:available.filter(plugin=>!failed[plugin.id]),failed}),[store,layers,user.id,user.accessLevel,messages,checked,available,failed]);
 const controllers=workspace.mounted.flatMap(({id,title,Controller})=>Controller?[<ToolScope key={id} toolId={id}><ToolBoundary message={workspace.messages.toolFailed(title)}><Controller toolId={id}/></ToolBoundary></ToolScope>]:[]);
 return <Context.Provider value={runtime}><WorkspaceContext.Provider value={workspace}>{controllers}{children}</WorkspaceContext.Provider></Context.Provider>;
}
/** Supplies the map to overlays below it and attaches it to the surrounding ToolboxProvider. */
export function MapAdapterProvider({adapter,children}:{adapter:MapAdapter;children:ReactNode}){
 const store=useContext(WorkspaceContext)?.store;
 useEffect(()=>{if(!store)return;store.attachMap(adapter);return ()=>store.detachMap(adapter);},[store,adapter]);
 return <MapContext.Provider value={adapter}>{children}</MapContext.Provider>;
}
/** @internal Gives overlays the workspace map when they are not already below a MapAdapterProvider; renders nothing without a map. */
export function MapScope({children}:{children:ReactNode}){
 const local=useContext(MapContext),map=useMapAdapter();
 if(!map)return null;
 return local?<>{children}</>:<MapContext.Provider value={map}>{children}</MapContext.Provider>;
}
/** Marks the tool a subtree belongs to; the runtime wraps every Panel, Overlay and Dialogs in one. */
export function ToolScope({toolId,children}:{toolId:string;children:ReactNode}){return <ToolContext.Provider value={toolId}>{children}</ToolContext.Provider>;}
export function useToolbox(){const value=useContext(Context);if(!value)throw new Error('ToolboxProvider is required');return value;}
export function useToolboxMap(){const value=useContext(MapContext);if(!value)throw new Error('MapAdapterProvider is required');return {current:value};}
/** Map adapter in scope (inside the map) or attached to the workspace (panels outside the map); undefined until ready. */
export function useMapAdapter():MapAdapter|undefined{
 const local=useContext(MapContext),store=useContext(WorkspaceContext)?.store;
 const subscribe=useCallback((listener:()=>void)=>store?store.subscribeMap(listener):()=>{},[store]);
 const attached=useSyncExternalStore(subscribe,()=>store?.getMap(),()=>store?.getMap());
 return local??attached;
}
/** @internal Runtime components read the computed plugin lists through this. */
export function useToolWorkspace(){const value=useContext(WorkspaceContext);if(!value)throw new Error('ToolboxProvider is required');return value;}
export function useToolId(){const value=useContext(ToolContext);if(!value)throw new Error('ToolScope is required');return value;}
export function useToolUser(){return useToolWorkspace().user;}
export function useToolMessages(){return useToolWorkspace().messages;}
/** Registry snapshot shared by the Layer Panel, Toolbox Panel and map overlays. */
export function useLayers(){
 const {registry}=useToolWorkspace();
 const snapshot=useSyncExternalStore(registry.subscribe,registry.getSnapshot,registry.getSnapshot);
 return {...snapshot,registry};
}
export function useLayer(id:string){
 const {layers,visible,opacity,registry}=useLayers();
 const layer=layers.find(item=>item.id===id);
 return layer?{layer,visible:!!visible[id],opacity:opacity[id]??layer.opacity,setVisible:(value:boolean)=>registry.setVisible(id,value),setOpacity:(value:number)=>registry.setOpacity(id,value)}:undefined;
}
/** Layers registered by the current tool (or `toolId`), in registry order. */
export function useToolLayers(toolId?:string):readonly LayerDefinition[]{
 const scoped=useContext(ToolContext),owner=toolId??scoped;
 const {layers}=useLayers();
 return useMemo(()=>layers.filter(layer=>layer.owner?.toolId===owner),[layers,owner]);
}
/** useState shared by every component of the current tool under the same key; lives as long as the provider. */
export function useToolState<T>(key:string,initial:T):[T,(update:StateUpdate<T>)=>void]{return useToolStateOf(useToolId(),key,initial);}
/** The same state read from outside the tool, e.g. a host reacting to a tool's public hook. */
export function useToolStateOf<T>(toolId:string,key:string,initial:T):[T,(update:StateUpdate<T>)=>void]{
 const {store}=useToolWorkspace();
 const first=useRef(initial).current;
 const subscribe=useCallback((listener:()=>void)=>store.subscribeState(toolId,key,listener),[store,toolId,key]);
 const read=()=>store.getState(toolId,key,first);
 const value=useSyncExternalStore(subscribe,read,read);
 const set=useCallback((update:StateUpdate<T>)=>store.setState(toolId,key,first,update),[store,toolId,key,first]);
 return [value,set];
}
const DIALOG='\u0000workspace';
type ActiveDialog={toolId:string;name:string}|null;
/**
 * Workspace-wide dialog slot: showing one tool dialog closes any other, so settings panels never stack.
 * `returnFocus` points at the element that last opened a dialog, for focus restoration on close.
 */
function useDialogController(toolId:string,name:string){
 const [active,setActive]=useToolStateOf<ActiveDialog>(DIALOG,'dialog',null);
 const [,setTrigger]=useToolStateOf<HTMLElement|null>(DIALOG,'trigger',null);
 const {store}=useToolWorkspace();
 const returnFocus=useMemo(()=>({get current(){return store.getState<HTMLElement|null>(DIALOG,'trigger',null) as HTMLButtonElement|null;}}),[store]);
 const open=active?.toolId===toolId&&active.name===name;
 const show=useCallback((trigger?:HTMLElement|null)=>{setTrigger(trigger??null);setActive({toolId,name});},[setActive,setTrigger,toolId,name]);
 const setOpen=useCallback((next:boolean)=>{if(next)show();else setActive(current=>current?.toolId===toolId&&current.name===name?null:current);},[show,setActive,toolId,name]);
 return {open,show,setOpen,close:()=>setOpen(false),returnFocus};
}
export function useToolDialog(name:string){return useDialogController(useToolId(),name);}
/** Settings dialog declared by the tool that owns `layerId` (see `ToolPlugin.layerSettings`), for host Layer Panels. */
export function useLayerSettings(layerId:string){
 const {mounted}=useToolWorkspace();
 const owner=useLayers().layers.find(layer=>layer.id===layerId)?.owner;
 const plugin=owner&&mounted.find(item=>item.id===owner.toolId);
 const name=plugin&&owner?plugin.layerSettings?.[owner.key]:undefined;
 const dialog=useDialogController(plugin?.id??'',name??'');
 return name?dialog:undefined;
}
