import type {AccessLevel,LayerDefinition} from './layers.js';
import type {MapAdapter} from './map.js';
import type {LayerRegistry} from './registry.js';

/** Identity the workspace scopes browser storage and tool access to. Never an authorization decision. */
export type ToolUser={id:string;accessLevel:AccessLevel};
export type StateUpdate<T>=T|((previous:T)=>T);

/**
 * Per-workspace runtime state without React: the attached map adapter(s) and named state slices per tool,
 * so a tool's Panel, Overlay and Dialogs share state without the host holding it.
 */
export function createToolWorkspaceStore(){
 // Last attached adapter wins; detaching it falls back to the previous one (e.g. a remounted bridge).
 let maps:MapAdapter[]=[];const mapListeners=new Set<()=>void>();
 const slices=new Map<string,unknown>(),sliceListeners=new Map<string,Set<()=>void>>();
 const slot=(toolId:string,key:string)=>`${toolId}\u0000${key}`;
 const changeMaps=(next:MapAdapter[])=>{const before=maps.at(-1);maps=next;if(maps.at(-1)!==before)mapListeners.forEach(fn=>fn());};
 return {
  getMap:()=>maps.at(-1),
  subscribeMap(listener:()=>void){mapListeners.add(listener);return ()=>{mapListeners.delete(listener);};},
  attachMap(adapter:MapAdapter){changeMaps([...maps.filter(m=>m!==adapter),adapter]);},
  detachMap(adapter:MapAdapter){changeMaps(maps.filter(m=>m!==adapter));},
  getState<T>(toolId:string,key:string,initial:T):T{const id=slot(toolId,key);return slices.has(id)?slices.get(id) as T:initial;},
  setState<T>(toolId:string,key:string,initial:T,update:StateUpdate<T>){
   const id=slot(toolId,key),previous=slices.has(id)?slices.get(id) as T:initial;
   const next=typeof update==='function'?(update as (previous:T)=>T)(previous):update;
   if(slices.has(id)&&Object.is(previous,next))return;
   slices.set(id,next);sliceListeners.get(id)?.forEach(fn=>fn());
  },
  subscribeState(toolId:string,key:string,listener:()=>void){
   const id=slot(toolId,key);let set=sliceListeners.get(id);if(!set){set=new Set();sliceListeners.set(id,set);}
   set.add(listener);return ()=>{set.delete(listener);};
  },
 };
}
export type ToolWorkspaceStore=ReturnType<typeof createToolWorkspaceStore>;

/**
 * Registers each tool's layers as one block, keeping tool order, at the start or end of the list.
 * A tool whose layers cannot be registered (e.g. an ID the host already uses) fails alone.
 */
export function registerPluginLayers(registry:LayerRegistry,plugins:readonly {id:string;layers?:readonly LayerDefinition[]}[],at:'start'|'end'='end'){
 const registered:string[]=[],failed:Record<string,string>={};
 for(const plugin of at==='start'?[...plugins].reverse():plugins){
  if(!plugin.layers?.length)continue;
  try{registry.registerOwned(plugin.id,plugin.layers,at);registered.push(plugin.id);}
  catch(error){failed[plugin.id]=error instanceof Error?error.message:String(error);}
 }
 return {failed,dispose(){for(const id of registered)registry.unregisterOwner(id);}};
}
