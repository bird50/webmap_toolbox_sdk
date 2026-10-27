"use client";
import {useEffect,useMemo} from "react";
import type {LayerDefinition} from "../core/layers.js";
import type {LayerPlacement} from "../core/registry.js";
import {useLayers,useToolId,useToolWorkspace} from "./context.js";

/** A layer definition without identity, owner or visibility: the template for layers a tool creates at runtime. */
export type LayerTemplate=Omit<LayerDefinition,"id"|"owner"|"visible">;
/** Turns an optional tool layer (from `toolLayer`) into a template; `false` when the host turned it off. */
export function layerTemplate(layer:LayerDefinition|undefined):LayerTemplate|false{
 if(!layer)return false;
 const {id:_id,owner:_owner,visible:_visible,...rest}=layer;void _id;void _owner;void _visible;return rest;
}
/** Where a tool with no layers yet puts its first one: inside its own block, in Toolbox order among the tools' layers. */
export function blockPlacement(all:readonly LayerDefinition[],order:readonly string[],toolId:string):LayerPlacement{
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
export function useOwnedLayers(key:string,template:LayerTemplate|false,items:readonly {id:string;name:string}[],ready:boolean,first:boolean){
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
