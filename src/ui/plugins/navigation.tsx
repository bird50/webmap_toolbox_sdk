"use client";
import {useLayers,useMapAdapter} from "../context.js";
import {TOOL_API_VERSION,type ToolPlugin} from "../contracts.js";
import type {ToolPluginOptions} from "./shared.js";

export type HomeView={longitude:number;latitude:number;zoom:number;label:string};
const thailand:HomeView={longitude:100.5,latitude:13.5,zoom:5,label:"แสดงประเทศไทย"};

/** Portable example: navigation through the MapAdapter and a count of visible registry layers. */
export function navigationTool({id="toolbox.navigation",title="มุมมองแผนที่",accessLevel="PUBLIC",home=thailand}:ToolPluginOptions&{home?:HomeView}={}):ToolPlugin{
 function Panel(){
  const map=useMapAdapter(),{layers,visible}=useLayers();
  return <section aria-label="เครื่องมือมุมมอง" className="rounded-xl border border-slate-200 p-3"><h3 className="mb-3 text-sm font-semibold">{title}</h3><button type="button" disabled={!map} className="rounded-md border px-3 py-2 text-xs focus-visible:outline-teal-600 disabled:opacity-50" onClick={()=>map?.navigate(home)}>{home.label}</button><p className="mt-2 text-[11px] text-slate-500">เปิดอยู่ {layers.filter(layer=>visible[layer.id]&&layer.url).length} ชั้นข้อมูล</p></section>;
 }
 return {id,title,version:"2.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires:["map.navigate"],Panel};
}
