import type {LayerDefinition,AccessLevel} from './layers.js';
export function canAccess(current:AccessLevel,required:AccessLevel){const rank={PUBLIC:0,MEMBER:1,ADMIN:2};return rank[current]>=rank[required];}
export type LayerSnapshot={layers:readonly LayerDefinition[];visible:Record<string,boolean>;opacity:Record<string,number>};
export function createLayerRegistry(initial:readonly LayerDefinition[]=[],access:AccessLevel='PUBLIC'){
 let snapshot:LayerSnapshot={layers:[],visible:{},opacity:{}};const listeners=new Set<()=>void>();
 const emit=()=>listeners.forEach(fn=>fn());
 function register(layer:LayerDefinition){
 if(!layer.id.trim()||snapshot.layers.some(l=>l.id===layer.id))throw new Error('Invalid or duplicate layer ID');
 if(!canAccess(access,layer.accessLevel))return false;
 if(!Number.isFinite(layer.opacity)||layer.opacity<0||layer.opacity>1||layer.minZoom>layer.maxZoom)throw new Error('Invalid layer metadata');
 snapshot={layers:[...snapshot.layers,{...layer}],visible:{...snapshot.visible,[layer.id]:layer.visible},opacity:{...snapshot.opacity,[layer.id]:layer.opacity}};emit();return true;
 }
 initial.forEach(register);
 return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},register,
 unregister(id:string){if(!snapshot.layers.some(l=>l.id===id))return;const visible={...snapshot.visible},opacity={...snapshot.opacity};delete visible[id];delete opacity[id];snapshot={layers:snapshot.layers.filter(l=>l.id!==id),visible,opacity};emit();},
 setVisible(id:string,value:boolean){if(!snapshot.layers.some(l=>l.id===id))return;snapshot={...snapshot,visible:{...snapshot.visible,[id]:value}};emit();},
 setOpacity(id:string,value:number){if(!snapshot.layers.some(l=>l.id===id)||!Number.isFinite(value))return;snapshot={...snapshot,opacity:{...snapshot.opacity,[id]:Math.max(0,Math.min(1,value))}};emit();},
 reorder(ids:readonly string[]){if(ids.length!==snapshot.layers.length||new Set(ids).size!==ids.length||ids.some(id=>!snapshot.layers.some(l=>l.id===id)))throw new Error('Invalid layer order');snapshot={...snapshot,layers:ids.map(id=>snapshot.layers.find(l=>l.id===id)!)};emit();}
 };
}
export type LayerRegistry=ReturnType<typeof createLayerRegistry>;
