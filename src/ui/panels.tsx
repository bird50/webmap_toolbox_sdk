"use client";
import {useState,useSyncExternalStore,type CSSProperties,type ReactNode,type Dispatch,type SetStateAction} from 'react';
import {createLayerRegistry,type LayerRegistry} from '../core/registry.js';
import type {LayerDefinition,AccessLevel} from '../core/layers.js';
import {useToolMessages} from './context.js';
export function useLayerRegistry(initial:readonly LayerDefinition[],access:AccessLevel){
 const [registry]=useState(()=>createLayerRegistry(initial,access));
 const snapshot=useSyncExternalStore(registry.subscribe,registry.getSnapshot,registry.getSnapshot);
 const setVisible:Dispatch<SetStateAction<Record<string,boolean>>>=change=>registry.update({visible:typeof change==='function'?change(registry.getSnapshot().visible):change});
 const setOpacity:Dispatch<SetStateAction<Record<string,number>>>=change=>registry.update({opacity:typeof change==='function'?change(registry.getSnapshot().opacity):change});
 return {...snapshot,registry,setVisible,setOpacity};
}
export function LayerPanel({registry}:{registry:LayerRegistry}){
 const state=useSyncExternalStore(registry.subscribe,registry.getSnapshot,registry.getSnapshot),t=useToolMessages().layerPanel;
 return <section aria-label={t.title}><h2>{t.title}</h2>{state.layers.map((layer,index)=><div key={layer.id} style={{padding:'8px 0'}}><label><input type="checkbox" checked={!!state.visible[layer.id]} onChange={event=>registry.setVisible(layer.id,event.target.checked)}/>{layer.title}</label><input aria-label={t.opacity(layer.title)} type="range" min="0" max="1" step="0.1" value={state.opacity[layer.id]} onChange={event=>registry.setOpacity(layer.id,Number(event.target.value))}/><button disabled={!index} aria-label={t.moveUp(layer.title)} onClick={()=>{const ids=state.layers.map(l=>l.id);[ids[index-1],ids[index]]=[ids[index],ids[index-1]];registry.reorder(ids);}}>↑</button></div>)}</section>;
}
/** Host owns placement. All three panels can also be mounted separately. */
export function WorkspacePanels({map,layer,toolbox,layerWidth=280,toolboxWidth=300,side='left',className,style}:{map:ReactNode;layer?:ReactNode;toolbox?:ReactNode;layerWidth?:number;toolboxWidth?:number;side?:'left'|'right';className?:string;style?:CSSProperties}){
 const t=useToolMessages().layerPanel;
 return <div className={`toolbox-sdk sdk-panels ${className??''}`} style={{display:'flex',minHeight:480,height:'100%',...style}}>
 {side==='left'&&layer&&<aside aria-label={t.layerPanel} style={{width:layerWidth,overflow:'auto',padding:12}}>{layer}</aside>}
 <main aria-label={t.mapPanel} style={{position:'relative',flex:1,minWidth:0}}>{map}</main>
 {side==='right'&&layer&&<aside aria-label={t.layerPanel} style={{width:layerWidth,overflow:'auto',padding:12}}>{layer}</aside>}
 {toolbox&&<aside aria-label={t.toolboxPanel} style={{width:toolboxWidth,overflow:'auto',padding:12}}>{toolbox}</aside>}
 </div>;
}
