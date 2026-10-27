"use client";
import {drawToolTh} from "../messages/drawTool.js";
import {PencilRuler,Settings} from "lucide-react";
import {Button} from "../primitives/button.js";
import {Switch} from "../primitives/switch.js";
import {useToolText} from "../context.js";
export type DrawToolProps={drawingToolbarOpen:boolean;onDrawingToolbarChange:(open:boolean)=>void;drawingCount:number;setCount:number;setsOnMap:number;publicSetsOnMap:number;onSets:(trigger:HTMLButtonElement)=>void;setsOpen:boolean;onPublic:(trigger:HTMLButtonElement)=>void;publicOpen:boolean};
/** Draw section of the Toolbox: the toolbar switch, My Drawing sets and the Public Drawing search (settings buttons only). */
export function DrawTool({drawingToolbarOpen,onDrawingToolbarChange,drawingCount,setCount,setsOnMap,publicSetsOnMap,onSets,setsOpen,onPublic,publicOpen}:DrawToolProps){
const t=useToolText("drawTool",drawToolTh);
return <section aria-labelledby="draw-tool-title" className="overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)]">
        <h3 id="draw-tool-title" className="flex items-center gap-2 border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3 text-sm font-semibold"><PencilRuler className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</h3>
        <div className="border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3"><div className="flex items-center justify-between gap-2"><label htmlFor="drawing-toolbar-toggle" className="text-xs font-semibold">{t.toolbar}</label><Switch id="drawing-toolbar-toggle" aria-controls="drawing-toolbar" checked={drawingToolbarOpen} onCheckedChange={onDrawingToolbarChange}/></div>
          {drawingToolbarOpen&&<p role="status" className="mt-2 text-[11px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.draft(drawingCount)}</p>}</div>
        <div className="border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{t.mine} <span className="font-normal text-[color:var(--sdk-muted,#64748b)]">{t.mineCount(setsOnMap,setCount)}</span></p><Button id="toolbox-my-drawing-settings" variant="ghost" size="icon" className="size-7 shrink-0" title={t.mineManage} aria-label={t.mineSettings} aria-haspopup="dialog" aria-expanded={setsOpen} onClick={event=>onSets(event.currentTarget)}><Settings/></Button></div><p className="mt-1 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.mineHint}</p></div>
        <div className="p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{t.public} <span className="font-normal text-[color:var(--sdk-muted,#64748b)]">{t.publicCount(publicSetsOnMap)}</span></p><Button id="toolbox-public-drawing-settings" variant="ghost" size="icon" className="size-7 shrink-0 text-[color:var(--sdk-info,#0284c7)]" title={t.publicSearch} aria-label={t.publicSettings} aria-haspopup="dialog" aria-expanded={publicOpen} onClick={event=>onPublic(event.currentTarget)}><Settings/></Button></div><p className="mt-1 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.publicHint}</p></div>
      </section>;
}
