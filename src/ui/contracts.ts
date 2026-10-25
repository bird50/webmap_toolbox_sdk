import {canAccess} from "../core/registry.js";
import type {MapAdapter} from "../core/map.js";
import type {LayerRegistry} from "../core/registry.js";
import type {ComponentType} from "react";
import type {AccessLevel,LayerDefinition} from "../core/layers.js";

/** Engine-independent contract. Coordinates are WGS84, opacity is 0–1. */
export const WEBMAP_API_VERSION = "1.0" as const;
export type WebmapCapability = "map.navigate" | "layers.control" | "map.viewport" | "map.project" | "map.events" | "layers.register";
export interface WebmapHost {
  map?:MapAdapter;
  registry?:LayerRegistry;
  apiVersion: typeof WEBMAP_API_VERSION;
  accessLevel: AccessLevel;
  capabilities: readonly WebmapCapability[];
  layers: readonly LayerDefinition[];
  visible: Readonly<Record<string,boolean>>;
  opacity: Readonly<Record<string,number>>;
  setLayerVisible(id:string,visible:boolean):void;
  setLayerOpacity(id:string,opacity:number):void;
  navigate(view:{longitude:number;latitude:number;zoom:number}):void;
}
export interface ToolboxDefinition<Services = unknown> {
  id:string;
  title:string;
  version:string;
  apiVersion:typeof WEBMAP_API_VERSION;
  accessLevel:AccessLevel;
  requires:readonly WebmapCapability[];
  Panel:ComponentType<{host:WebmapHost;services:Services}>;
}
export {canAccess} from "../core/registry.js";
export function toolboxAvailable(tool:Pick<ToolboxDefinition,"apiVersion"|"accessLevel"|"requires">,host:WebmapHost) {
  return tool.apiVersion===host.apiVersion && canAccess(host.accessLevel,tool.accessLevel) && tool.requires.every(cap=>host.capabilities.includes(cap));
}
export function defineToolboxes<S>(tools:readonly ToolboxDefinition<S>[]):readonly ToolboxDefinition<S>[] {
  const ids=new Set<string>();
  for(const tool of tools){
    if(!tool.id.trim()||ids.has(tool.id))throw new Error(`Invalid or duplicate toolbox ID: ${tool.id}`);
    ids.add(tool.id);
  }
  return tools;
}
