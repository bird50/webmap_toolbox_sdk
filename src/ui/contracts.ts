import {canAccess} from "../core/registry.js";
import type {MapAdapter} from "../core/map.js";
import type {LayerRegistry} from "../core/registry.js";
import type {ComponentType} from "react";
import type {AccessLevel,LayerDefinition} from "../core/layers.js";

/** Capabilities a tool may require; the provider grants them from the attached MapAdapter and the host. Coordinates are WGS84, opacity 0–1. */
export type WebmapCapability = "map.navigate" | "layers.control" | "map.viewport" | "map.project" | "map.events" | "layers.register" | "map.pointer" | "map.geojson" | "map.overlay";
export {canAccess} from "../core/registry.js";

/**
 * Tool API 2.0: a self-contained tool that owns its layers,
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
  /** Headless; mounted by ToolboxProvider for as long as the tool is mounted. Owns loading, timers and other effects the views share. */
  Controller?:ComponentType<ToolComponentProps>;
  /** Owner key of a tool layer → name of the dialog that configures it, so a host Layer Panel can offer a settings button. */
  layerSettings?:Readonly<Record<string,string>>;
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
