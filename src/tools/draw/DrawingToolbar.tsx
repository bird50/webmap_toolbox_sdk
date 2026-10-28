"use client";

import {drawingToolbarTh} from "./messages/drawingToolbar.js";
import {MousePointer2,Hand,Pencil,Highlighter,Eraser,MapPin,Minus,Hexagon,RectangleHorizontal,Circle,MoveUpRight,Type,Square,MessageSquare,Tag,StickyNote,ListOrdered,List,Undo2,Redo2,Trash2,X,Check} from "lucide-react";
import type {ReactNode} from "react";
import {Button} from "../../ui/primitives/button.js";
import {Input} from "../../ui/primitives/input.js";
import {textTools,type Coordinate,type DrawTool,type DrawingStyle} from "./drawing.js";
import {useToolText} from "../../ui/context.js";

const groups=[
  {id:"basic",tools:[{id:"select",icon:MousePointer2},{id:"pan",icon:Hand},{id:"pen",icon:Pencil},{id:"highlighter",icon:Highlighter},{id:"eraser",icon:Eraser},{id:"point",icon:MapPin},{id:"line",icon:Minus},{id:"polygon",icon:Hexagon},{id:"rectangle",icon:RectangleHorizontal},{id:"circle",icon:Circle},{id:"arrow",icon:MoveUpRight}]},
  {id:"text",tools:[{id:"text",icon:Type},{id:"textbox",icon:Square},{id:"callout",icon:MessageSquare},{id:"label",icon:Tag},{id:"sticky",icon:StickyNote},{id:"number",icon:ListOrdered},{id:"legend",icon:List}]},
] as const;

export function DrawingToolbar({tool,onTool,style,onStyle,text,onText,selected,selectedTool,selectedPoints,onDelete,onClose,onFinish,onCancel,canFinish,hasDraft,undo,redo,canUndo,canRedo,message,count,children}:{
  tool:DrawTool;onTool:(tool:DrawTool)=>void;style:DrawingStyle;onStyle:(style:DrawingStyle)=>void;text:string;onText:(text:string)=>void;selected:boolean;selectedTool?:DrawTool;selectedPoints?:Coordinate[];onDelete:()=>void;onClose:()=>void;onFinish:()=>void;onCancel:()=>void;canFinish:boolean;hasDraft:boolean;undo:()=>void;redo:()=>void;canUndo:boolean;canRedo:boolean;message:string;count:number;children?:ReactNode;
}) {
  const t=useToolText("drawingToolbar",drawingToolbarTh);
  const editingTool=selectedTool??tool;
  const isText=textTools.includes(editingTool);
  const fieldClass="h-8 w-full rounded-md border border-input bg-white px-2 text-xs";
  return <section id="drawing-toolbar" aria-label={t.title} className="pointer-events-auto absolute sdk-drawing-toolbar z-20 max-h-[calc(100%-72px)] w-[224px] overflow-y-auto rounded-xl border border-[color:var(--sdk-border,#e2e8f0)] bg-white shadow-lg" onPointerDown={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()}>
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2"><div><h2 className="text-xs font-semibold">{t.title}</h2><p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.retention}</p></div><Button variant="ghost" size="icon" className="size-7" aria-label={t.close} onClick={onClose}><X/></Button></header>
    <div className="space-y-3 p-3">
      {selectedPoints&&selectedPoints.length>0&&<section aria-label={t.selectedCoords} className="rounded-lg border border-[color:var(--sdk-danger-soft-strong,#fee2e2)] bg-[color:var(--sdk-danger-soft,#fef2f2)]/50 p-2">
        <h3 className="text-[11px] font-semibold">{t.selectedCoords}</h3>
        <p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.coordsCrs}</p>
        <ol className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[10px] tabular-nums" aria-label={t.coordPoints}>
          {selectedPoints.map(([lng,lat],index)=><li key={index} className="flex gap-1"><span className="w-6 shrink-0 text-[color:var(--sdk-muted,#64748b)]">{index+1}.</span><span>{lat.toFixed(6)}, {lng.toFixed(6)}</span></li>)}
        </ol>
      </section>}
      {groups.map(group=><div key={group.id}><h3 className="mb-2 text-[10px] font-semibold text-[color:var(--sdk-muted,#64748b)]">{t.groups[group.id]}</h3><div className="grid grid-cols-2 gap-1" role="group" aria-label={t.groups[group.id]}>{group.tools.map(item=><Button key={item.id} variant={tool===item.id?"secondary":"ghost"} size="sm" className={`h-auto min-h-8 justify-start gap-1.5 whitespace-normal px-2 text-[11px] ${tool===item.id?"bg-[color:var(--sdk-primary-soft-strong,#ccfbf1)] text-[color:var(--sdk-primary-strong,#115e59)] ring-1 ring-[color:var(--sdk-primary-muted,#5eead4)]":""}`} aria-pressed={tool===item.id} title={t.hints[item.id]} onClick={()=>onTool(item.id)}><item.icon className="shrink-0"/><span className="text-left leading-4">{t.tools[item.id]}</span></Button>)}</div></div>)}
      <p className="rounded-md bg-[color:var(--sdk-primary-soft,#f0fdfa)] p-2 text-[11px] leading-5 text-[color:var(--sdk-primary-strong,#115e59)]">{t.hints[tool]}</p>
      {hasDraft&&<div className="flex gap-1"><Button size="sm" disabled={!canFinish} onClick={onFinish}><Check/>{t.finish}</Button><Button variant="ghost" size="sm" onClick={onCancel}>{t.cancel}</Button></div>}
      <div className="space-y-2 border-t pt-3">
        <h3 className="text-[11px] font-semibold">{selected?t.editSelected:t.newStyle}</h3>
        {isText&&editingTool!=="number"&&<label className="block text-[11px]">{editingTool==="legend"?t.legendItems:t.textLabel}<textarea className="mt-1 min-h-16 w-full rounded-md border border-input p-2 text-xs" maxLength={1000} value={text} onChange={event=>onText(event.target.value)} placeholder={t.textPlaceholder}/></label>}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px]">{t.color}<Input type="color" className="mt-1 h-8 p-1" value={style.color} onChange={e=>onStyle({...style,color:e.target.value})}/></label>
          <label className="text-[11px]">{t.lineWidth}<Input type="number" min={1} max={40} className={fieldClass+" mt-1"} value={style.width} onChange={e=>onStyle({...style,width:Math.min(40,Math.max(1,Number(e.target.value)))})}/></label>
        </div>
        <label className="block text-[11px]">{t.transparency(Math.round((1-style.opacity)*100))}<input className="mt-1 w-full" type="range" min={0.05} max={1} step={0.05} value={style.opacity} onChange={e=>onStyle({...style,opacity:Number(e.target.value)})}/></label>
        {isText&&<>
          <label className="block text-[11px]">{t.font}<select aria-label={t.font} className={fieldClass+" mt-1"} value={style.font} onChange={e=>onStyle({...style,font:e.target.value})}><option value="sans-serif">{t.fontSans}</option><option value="serif">{t.fontSerif}</option><option value="monospace">{t.fontMono}</option></select></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-[11px]">{t.size}<Input type="number" min={10} max={96} className={fieldClass+" mt-1"} value={style.fontSize} onChange={e=>onStyle({...style,fontSize:Math.min(96,Math.max(10,Number(e.target.value)))})}/></label><label className="text-[11px]">{t.rotation}<Input type="number" min={-180} max={180} className={fieldClass+" mt-1"} value={style.rotation} onChange={e=>onStyle({...style,rotation:Math.min(180,Math.max(-180,Number(e.target.value)))})}/></label><label className="text-[11px]">{t.background}<Input type="color" className="mt-1 h-8 p-1" value={style.background} onChange={e=>onStyle({...style,background:e.target.value})}/></label><label className="text-[11px]">{t.border}<Input type="color" className="mt-1 h-8 p-1" value={style.border} onChange={e=>onStyle({...style,border:e.target.value})}/></label></div>
          <label className="block text-[11px]">{t.alignment}<select aria-label={t.alignment} className={fieldClass+" mt-1"} value={style.alignment} onChange={e=>onStyle({...style,alignment:e.target.value as DrawingStyle["alignment"]})}><option value="left">{t.alignLeft}</option><option value="center">{t.alignCenter}</option><option value="right">{t.alignRight}</option></select></label>
        </>}
      </div>
      <div className="flex gap-1 border-t pt-2"><Button variant="outline" size="icon" aria-label={t.undo} title={t.undoTitle} disabled={!canUndo} onClick={undo}><Undo2/></Button><Button variant="outline" size="icon" aria-label={t.redo} disabled={!canRedo} onClick={redo}><Redo2/></Button><Button variant="outline" size="icon" aria-label={t.deleteSelected} disabled={!selected} onClick={onDelete}><Trash2/></Button></div>
      {children}
      <p role="status" className="text-[11px] text-[color:var(--sdk-warning,#b45309)]">{message}</p>
      <p className="text-[10px] leading-4 text-[color:var(--sdk-muted,#64748b)]">{t.footer(count)}</p>
    </div>
  </section>;
}
