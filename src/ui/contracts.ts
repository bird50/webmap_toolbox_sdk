import {canAccess} from "../core/registry.js";
import type {MapAdapter} from "../core/map.js";
import type {LayerRegistry} from "../core/registry.js";
import type {ComponentType} from "react";
import type {AccessLevel,LayerDefinition} from "../core/layers.js";

/** Engine-independent contract. Coordinates are WGS84, opacity is 0–1. */
export const WEBMAP_API_VERSION = "1.0" as const;
export type WebmapCapability = "map.navigate" | "layers.control" | "map.viewport" | "map.project" | "map.events" | "layers.register" | "map.pointer" | "map.geojson" | "map.overlay";
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

/**
 * Tool API 2.0 (preview, not yet mounted by a runtime): a self-contained tool that owns its layers,
 * state, map overlay and dialogs. Components receive only their tool ID and read everything else from context.
 */
export const TOOL_API_VERSION = "2.0" as const;
export type ToolComponentProps = {toolId:string};
export interface ToolPlugin {
  id:string;
  title:string;
  version:string;
  apiVersion:typeof TOOL_API_VERSION;
  accessLevel:AccessLevel;
  requires:readonly WebmapCapability[];
  /** Registered with `owner.toolId = id` when the tool mounts and removed when it unmounts. */
  layers?:readonly LayerDefinition[];
  Panel:ComponentType<ToolComponentProps>;
  /** Rendered inside the Map Panel. */
  Overlay?:ComponentType<ToolComponentProps>;
  /** Rendered once, outside the panels, for settings and modal UI. */
  Dialogs?:ComponentType<ToolComponentProps>;
}
export type ToolEnvironment = {apiVersion:typeof TOOL_API_VERSION;accessLevel:AccessLevel;capabilities:readonly WebmapCapability[]};
export function pluginAvailable(plugin:Pick<ToolPlugin,"apiVersion"|"accessLevel"|"requires">,environment:ToolEnvironment) {
  return plugin.apiVersion===environment.apiVersion && canAccess(environment.accessLevel,plugin.accessLevel) && plugin.requires.every(cap=>environment.capabilities.includes(cap));
}
/** Rejects empty or duplicate tool IDs and layer IDs claimed by more than one tool. */
export function definePlugins(plugins:readonly ToolPlugin[]):readonly ToolPlugin[] {
  const ids=new Set<string>(),layers=new Set<string>();
  for(const plugin of plugins){
    if(!plugin.id.trim()||ids.has(plugin.id))throw new Error(`Invalid or duplicate tool ID: ${plugin.id}`);
    ids.add(plugin.id);
    for(const layer of plugin.layers??[]){
      if(layers.has(layer.id))throw new Error(`Layer ${layer.id} is claimed by more than one tool`);
      layers.add(layer.id);
    }
  }
  return plugins;
}
/** Capabilities a MapAdapter actually implements, so hosts never advertise optional features they lack. */
export function mapCapabilities(map:MapAdapter|undefined):WebmapCapability[] {
  if(!map)return [];
  return ["map.viewport","map.project","map.events",...(map.onPointer&&map.offPointer?["map.pointer" as const]:[]),...(map.geojson?["map.geojson" as const]:[]),...(map.getContainer?["map.overlay" as const]:[])];
}
