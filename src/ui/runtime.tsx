"use client";
import type {ComponentType} from "react";
import {MapScope,ToolScope,useToolWorkspace} from "./context.js";
import {ToolBoundary} from "./boundary.js";
import type {ToolComponentProps,ToolPlugin} from "./contracts.js";

function mount(plugins:readonly ToolPlugin[],slot:(plugin:ToolPlugin)=>ComponentType<ToolComponentProps>|undefined,message:(title:string)=>string){
  return plugins.flatMap(plugin=>{
    const View=slot(plugin);
    return View?[<ToolScope key={plugin.id} toolId={plugin.id}><ToolBoundary message={message(plugin.title)}><View toolId={plugin.id}/></ToolBoundary></ToolScope>]:[];
  });
}
/** Toolbox Panel content: every mounted tool's Panel in plugin order, plus a notice for tools whose layers failed. */
export function ToolboxPanel() {
  const {plugins,mounted,failed,messages}=useToolWorkspace();
  const failures=plugins.filter(plugin=>failed[plugin.id]).map(plugin=><p key={plugin.id} role="alert" className="rounded-lg border p-3 text-xs text-[color:var(--sdk-warning,#b45309)]">{messages.layersFailed(plugin.title)}</p>);
  if(!mounted.length&&!failures.length)return <p role="status" className="text-xs text-[color:var(--sdk-muted,#64748b)]">{messages.noTools}</p>;
  return <>{failures}{mount(mounted,plugin=>plugin.Panel,messages.toolFailed)}</>;
}
/** Map Panel content: place inside the map (below MapLibreToolboxBridge for MapLibre renderers). Renders nothing until a map is in scope or attached. */
export function ToolOverlays() {
  const {mounted,messages}=useToolWorkspace();
  return <MapScope>{mount(mounted,plugin=>plugin.Overlay,messages.toolFailed)}</MapScope>;
}
/** Settings and modal UI of every mounted tool; place once, outside the three panels. */
export function ToolDialogs() {
  const {mounted,messages}=useToolWorkspace();
  return <>{mount(mounted,plugin=>plugin.Dialogs,messages.toolFailed)}</>;
}
