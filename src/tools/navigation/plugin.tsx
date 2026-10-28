"use client";
import {useLayers,useMapAdapter,useToolText} from "../../ui/context.js";
import {TOOL_API_VERSION,type ToolPlugin} from "../../ui/contracts.js";
import type {ToolPluginOptions} from "../../ui/plugins/shared.js";
import {navigationTh} from "./messages/navigation.js";

export type HomeView={longitude:number;latitude:number;zoom:number;label:string};
const thailand:HomeView={longitude:100.5,latitude:13.5,zoom:5,label:navigationTh.homeLabel};

/** Portable example: navigation through the MapAdapter and a count of visible registry layers. */
export function navigationTool({id="toolbox.navigation",title=navigationTh.title,accessLevel="PUBLIC",home=thailand}:ToolPluginOptions&{home?:HomeView}={}):ToolPlugin{
 function Panel(){
  const map=useMapAdapter(),{layers,visible}=useLayers(),t=useToolText("navigation",navigationTh);
  return <section aria-label={t.panel} className="rounded-xl border border-[color:var(--sdk-border,#e2e8f0)] p-3"><h3 className="mb-3 text-sm font-semibold">{title}</h3><button type="button" disabled={!map} className="rounded-md border px-3 py-2 text-xs focus-visible:outline-[color:var(--sdk-ring,#0d9488)] disabled:opacity-50" onClick={()=>map?.navigate(home)}>{home.label}</button><p className="mt-2 text-[11px] text-[color:var(--sdk-muted,#64748b)]">{t.visibleLayers(layers.filter(layer=>visible[layer.id]&&layer.url).length)}</p></section>;
 }
 return {id,title,version:"2.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires:["map.navigate"],Panel};
}
