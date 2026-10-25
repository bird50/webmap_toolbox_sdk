"use client";
import {toolboxAvailable,type ToolboxDefinition,type WebmapHost} from "./contracts.js";
import {ToolBoundary} from "./boundary.js";
import {thMessages} from "./messages.js";

/** Mount/unmount panels normally; hooks in each panel own their cleanup. */
export function ToolboxHost<S>({tools,host,services}:{tools:readonly ToolboxDefinition<S>[];host:WebmapHost;services:S}) {
  const available=tools.filter(tool=>toolboxAvailable(tool,host));
  return available.length?available.map(({id,title,Panel})=><ToolBoundary key={id} message={thMessages.toolFailed(title)}><Panel host={host} services={services}/></ToolBoundary>):<p role="status" className="text-xs text-slate-500">{thMessages.noTools}</p>;
}
