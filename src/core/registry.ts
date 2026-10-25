import type {LayerDefinition,AccessLevel} from './layers.js';
export function canAccess(current:AccessLevel,required:AccessLevel){const rank={PUBLIC:0,MEMBER:1,ADMIN:2};return rank[current]>=rank[required];}
export type LayerSnapshot={layers:readonly LayerDefinition[];visible:Record<string,boolean>;opacity:Record<string,number>};
/** Where owned layers enter the list; the list is drawn first = top. Unknown `before` IDs append. */
export type LayerPlacement='start'|'end'|{before:string};
export function createLayerRegistry(initial:readonly LayerDefinition[]=[],access:AccessLevel='PUBLIC'){
 let snapshot:LayerSnapshot={layers:[],visible:{},opacity:{}};const listeners=new Set<()=>void>();
 const emit=()=>listeners.forEach(fn=>fn());
 const exists=(id:string)=>snapshot.layers.some(l=>l.id===id);
 function validate(layer:LayerDefinition){
 if(!Number.isFinite(layer.opacity)||layer.opacity<0||layer.opacity>1||layer.minZoom>layer.maxZoom)throw new Error('Invalid layer metadata');
 }
 function register(layer:LayerDefinition){
 if(!layer.id.trim()||exists(layer.id))throw new Error('Invalid or duplicate layer ID');
 if(!canAccess(access,layer.accessLevel))return false;
 validate(layer);
 snapshot={layers:[...snapshot.layers,{...layer}],visible:{...snapshot.visible,[layer.id]:layer.visible},opacity:{...snapshot.opacity,[layer.id]:layer.opacity}};emit();return true;
 }
 /** All-or-nothing: validates every layer before any change, then emits once. Returns the IDs the access level allows. */
 function registerOwned(toolId:string,layers:readonly LayerDefinition[],placement:LayerPlacement='end'){
 if(!toolId.trim())throw new Error('Invalid tool ID');
 const ids=layers.map(l=>l.id);
 if(ids.some(id=>!id.trim()||exists(id))||new Set(ids).size!==ids.length)throw new Error('Invalid or duplicate layer ID');
 const allowed=layers.filter(l=>canAccess(access,l.accessLevel));allowed.forEach(validate);
 if(!allowed.length)return [];
 const owned=allowed.map(l=>({...l,owner:{toolId,key:l.owner?.key??l.id}}));
 const at=placement==='start'?0:placement==='end'?-1:snapshot.layers.findIndex(l=>l.id===placement.before);
 const list=[...snapshot.layers];list.splice(at<0?list.length:at,0,...owned);
 snapshot={layers:list,visible:{...snapshot.visible,...Object.fromEntries(owned.map(l=>[l.id,l.visible]))},opacity:{...snapshot.opacity,...Object.fromEntries(owned.map(l=>[l.id,l.opacity]))}};emit();
 return owned.map(l=>l.id);
 }
 function remove(drop:(layer:LayerDefinition)=>boolean){
 const removed=snapshot.layers.filter(drop);if(!removed.length)return;
 const visible={...snapshot.visible},opacity={...snapshot.opacity};for(const {id} of removed){delete visible[id];delete opacity[id];}
 snapshot={layers:snapshot.layers.filter(l=>!drop(l)),visible,opacity};emit();
 }
 /** Applies several visibility/opacity changes with one emit; unknown IDs are ignored and no-ops do not emit. */
 function update(patch:{visible?:Readonly<Record<string,boolean>>;opacity?:Readonly<Record<string,number>>}){
 const visible={...snapshot.visible},opacity={...snapshot.opacity};let changed=false;
 for(const [id,value] of Object.entries(patch.visible??{}))if(exists(id)&&visible[id]!==value){visible[id]=value;changed=true;}
 for(const [id,value] of Object.entries(patch.opacity??{})){if(!exists(id)||!Number.isFinite(value))continue;const next=Math.max(0,Math.min(1,value));if(opacity[id]!==next){opacity[id]=next;changed=true;}}
 if(changed){snapshot={...snapshot,visible,opacity};emit();}
 }
 initial.forEach(register);
 return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},register,registerOwned,update,
 unregister(id:string){remove(l=>l.id===id);},
 unregisterOwner(toolId:string){remove(l=>l.owner?.toolId===toolId);},
 setVisible(id:string,value:boolean){update({visible:{[id]:value}});},
 setOpacity(id:string,value:number){update({opacity:{[id]:value}});},
 reorder(ids:readonly string[]){if(ids.length!==snapshot.layers.length||new Set(ids).size!==ids.length||ids.some(id=>!exists(id)))throw new Error('Invalid layer order');snapshot={...snapshot,layers:ids.map(id=>snapshot.layers.find(l=>l.id===id)!)};emit();}
 };
}
export type LayerRegistry=ReturnType<typeof createLayerRegistry>;
