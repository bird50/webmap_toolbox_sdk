"use client";
import {PencilRuler} from "lucide-react";
import {Switch} from "../primitives/switch.js";
import type {LayerDefinition} from "../../core/layers.js";
import {useToolMessages} from "../context.js";
export type DrawToolProps={drawingLayers:LayerDefinition[];visible:Readonly<Record<string,boolean>>;onDrawingVisible:(id:string,visible:boolean)=>void;drawingToolbarOpen:boolean;onDrawingToolbarChange:(open:boolean)=>void;drawingCount:number};
export function DrawTool({drawingLayers,visible,onDrawingVisible,drawingToolbarOpen,onDrawingToolbarChange,drawingCount}:DrawToolProps){
const t=useToolMessages().drawTool;
return <section aria-labelledby="draw-tool-title" className="overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)]">
        <h3 id="draw-tool-title" className="flex items-center gap-2 border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3 text-sm font-semibold"><PencilRuler className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</h3>
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3"><label htmlFor="drawing-toolbar-toggle" className="text-xs font-semibold">{t.toolbar}</label><Switch id="drawing-toolbar-toggle" aria-controls="drawing-toolbar" checked={drawingToolbarOpen} onCheckedChange={onDrawingToolbarChange}/></div>
        {drawingLayers.map(layer=><div key={layer.id} className="border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3 last:border-b-0">
          <div className="flex items-center justify-between gap-2"><label htmlFor={`toolbox-${layer.id}`} className="flex items-center gap-2 text-xs font-semibold"><PencilRuler className="size-4 shrink-0" style={{color:layer.color}}/>{t.layer(layer.title)}</label><Switch id={`toolbox-${layer.id}`} checked={!!visible[layer.id]} onCheckedChange={checked=>onDrawingVisible(layer.id,checked)}/></div>
          {visible[layer.id]&&<p role="status" className="mt-2 text-[11px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{layer.owner?.key==="mine"&&drawingCount>0?t.localCount(drawingCount):layer.owner?.key==="public"?t.publicHint:t.empty}</p>}
        </div>)}
      </section>;
}
