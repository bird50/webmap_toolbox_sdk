"use client";
import {PencilRuler} from "lucide-react";
import {Switch} from "../primitives/switch.js";
import type {DrawingServices} from "../services.js";
export function DrawTool({drawingLayers,visible,onDrawingVisible,drawingToolbarOpen,onDrawingToolbarChange,drawingCount}:DrawingServices){
return <section aria-labelledby="draw-tool-title" className="overflow-hidden rounded-xl border border-slate-200">
        <h3 id="draw-tool-title" className="flex items-center gap-2 border-b border-slate-100 p-3 text-sm font-semibold"><PencilRuler className="size-4 text-teal-700"/>Draw</h3>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-3"><label htmlFor="drawing-toolbar-toggle" className="text-xs font-semibold">Drawing Toolbar</label><Switch id="drawing-toolbar-toggle" aria-controls="drawing-toolbar" checked={drawingToolbarOpen} onCheckedChange={onDrawingToolbarChange}/></div>
        {drawingLayers.map(layer=><div key={layer.id} className="border-b border-slate-100 p-3 last:border-b-0">
          <div className="flex items-center justify-between gap-2"><label htmlFor={`toolbox-${layer.id}`} className="flex items-center gap-2 text-xs font-semibold"><PencilRuler className="size-4 shrink-0" style={{color:layer.color}}/>Layer {layer.title}</label><Switch id={`toolbox-${layer.id}`} checked={!!visible[layer.id]} onCheckedChange={checked=>onDrawingVisible(layer.id,checked)}/></div>
          {visible[layer.id]&&<p role="status" className="mt-2 text-[11px] leading-5 text-slate-500">{layer.drawingDataKey==="my-drawing"&&drawingCount>0?`${drawingCount} วัตถุ · บันทึกบนเครื่องได้ 15 วัน`:layer.drawingDataKey==="public-drawing"?"โหลดรูปวาดสาธารณะตามพื้นที่แผนที่":"ยังไม่มี My Drawing"}</p>}
        </div>)}
      </section>;
}
