"use client";

import {MousePointer2,Hand,Pencil,Highlighter,Eraser,MapPin,Minus,Hexagon,RectangleHorizontal,Circle,MoveUpRight,Type,Square,MessageSquare,Tag,StickyNote,ListOrdered,List,Undo2,Redo2,Trash2,X,Check} from "lucide-react";
import type {ReactNode} from "react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {textTools,type Coordinate,type DrawTool,type DrawingStyle} from "../core/drawing.js";

const groups=[
  {title:"เครื่องมือวาดพื้นฐาน",tools:[{id:"select",name:"Select",icon:MousePointer2},{id:"pan",name:"Pan",icon:Hand},{id:"pen",name:"Pen",icon:Pencil},{id:"highlighter",name:"Highlighter",icon:Highlighter},{id:"eraser",name:"Eraser",icon:Eraser},{id:"point",name:"Point",icon:MapPin},{id:"line",name:"Line",icon:Minus},{id:"polygon",name:"Polygon",icon:Hexagon},{id:"rectangle",name:"Rectangle",icon:RectangleHorizontal},{id:"circle",name:"Circle",icon:Circle},{id:"arrow",name:"Arrow",icon:MoveUpRight}]},
  {title:"ข้อความและคำอธิบาย",tools:[{id:"text",name:"Text",icon:Type},{id:"textbox",name:"Textbox",icon:Square},{id:"callout",name:"Callout",icon:MessageSquare},{id:"label",name:"Label",icon:Tag},{id:"sticky",name:"Sticky Note",icon:StickyNote},{id:"number",name:"Number Marker",icon:ListOrdered},{id:"legend",name:"Legend",icon:List}]},
] as const;
const hints:Record<DrawTool,string>={select:"คลิกวัตถุเพื่อเลือก ลากเพื่อย้าย ลากจุดมุมล่างขวาเพื่อปรับขนาด",pan:"ลากเพื่อเลื่อนแผนที่",pen:"ลากเมาส์หรือนิ้วเพื่อวาดเส้นอิสระ",highlighter:"ลากเพื่อเน้นพื้นที่ด้วยสีโปร่งใส",eraser:"คลิกวัตถุที่ต้องการลบ",point:"คลิกบนแผนที่เพื่อเพิ่มจุด",line:"คลิกเพิ่มจุด แล้วกดเสร็จสิ้น หรือ Enter",polygon:"คลิกอย่างน้อย 3 จุด แล้วกดเสร็จสิ้น หรือ Enter",rectangle:"ลากจากมุมหนึ่งไปอีกมุมหนึ่ง",circle:"ลากจากจุดศูนย์กลางไปยังขอบวงกลม",arrow:"ลากจากต้นลูกศรไปยังปลายลูกศร",text:"กรอกข้อความ แล้วคลิกตำแหน่งบนแผนที่",textbox:"กรอกข้อความ แล้วคลิกเพื่อวางกล่องข้อความ",callout:"กรอกข้อความ แล้วลากจากจุดที่ต้องการชี้ไปยังตำแหน่งข้อความ",label:"กรอกชื่อ แล้วคลิกตำแหน่งที่ต้องการติดป้าย",sticky:"กรอกบันทึก แล้วคลิกเพื่อวางโน้ต",number:"คลิกเพื่อเพิ่มหมุดหมายเลขตามลำดับ",legend:"ใส่คำอธิบายหนึ่งรายการต่อบรรทัด แล้วคลิกเพื่อวาง Legend"};

export function DrawingToolbar({tool,onTool,style,onStyle,text,onText,selected,selectedTool,selectedPoints,onDelete,onClose,onFinish,onCancel,canFinish,hasDraft,undo,redo,canUndo,canRedo,message,count,children}:{
  tool:DrawTool;onTool:(tool:DrawTool)=>void;style:DrawingStyle;onStyle:(style:DrawingStyle)=>void;text:string;onText:(text:string)=>void;selected:boolean;selectedTool?:DrawTool;selectedPoints?:Coordinate[];onDelete:()=>void;onClose:()=>void;onFinish:()=>void;onCancel:()=>void;canFinish:boolean;hasDraft:boolean;undo:()=>void;redo:()=>void;canUndo:boolean;canRedo:boolean;message:string;count:number;children?:ReactNode;
}) {
  const editingTool=selectedTool??tool;
  const isText=textTools.includes(editingTool);
  const fieldClass="h-8 w-full rounded-md border border-input bg-white px-2 text-xs";
  return <section id="drawing-toolbar" aria-label="Drawing Toolbar" className="pointer-events-auto absolute sdk-drawing-toolbar z-20 max-h-[calc(100%-72px)] w-[224px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg" onPointerDown={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()}>
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2"><div><h2 className="text-xs font-semibold">Drawing Toolbar</h2><p className="mt-1 text-[10px] text-slate-500">บันทึกบนเครื่องได้ 15 วัน</p></div><Button variant="ghost" size="icon" className="size-7" aria-label="ปิดเครื่องมือวาด" onClick={onClose}><X/></Button></header>
    <div className="space-y-3 p-3">
      {selectedPoints&&selectedPoints.length>0&&<section aria-label="พิกัดวัตถุที่เลือก" className="rounded-lg border border-red-100 bg-red-50/50 p-2">
        <h3 className="text-[11px] font-semibold">พิกัดวัตถุที่เลือก</h3>
        <p className="mt-1 text-[10px] text-slate-500">WGS84 · ละติจูด, ลองจิจูด</p>
        <ol className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[10px] tabular-nums" aria-label="จุดพิกัด">
          {selectedPoints.map(([lng,lat],index)=><li key={index} className="flex gap-1"><span className="w-6 shrink-0 text-slate-500">{index+1}.</span><span>{lat.toFixed(6)}, {lng.toFixed(6)}</span></li>)}
        </ol>
      </section>}
      {groups.map(group=><div key={group.title}><h3 className="mb-2 text-[10px] font-semibold text-slate-500">{group.title}</h3><div className="grid grid-cols-2 gap-1" role="group" aria-label={group.title}>{group.tools.map(item=><Button key={item.id} variant={tool===item.id?"secondary":"ghost"} size="sm" className={`h-auto min-h-8 justify-start gap-1.5 whitespace-normal px-2 text-[11px] ${tool===item.id?"bg-teal-100 text-teal-800 ring-1 ring-teal-300":""}`} aria-pressed={tool===item.id} title={hints[item.id]} onClick={()=>onTool(item.id)}><item.icon className="shrink-0"/><span className="text-left leading-4">{item.name}</span></Button>)}</div></div>)}
      <p className="rounded-md bg-teal-50 p-2 text-[11px] leading-5 text-teal-800">{hints[tool]}</p>
      {hasDraft&&<div className="flex gap-1"><Button size="sm" disabled={!canFinish} onClick={onFinish}><Check/>เสร็จสิ้น</Button><Button variant="ghost" size="sm" onClick={onCancel}>ยกเลิก</Button></div>}
      <div className="space-y-2 border-t pt-3">
        <h3 className="text-[11px] font-semibold">{selected?"ปรับวัตถุที่เลือก":"รูปแบบวัตถุใหม่"}</h3>
        {isText&&editingTool!=="number"&&<label className="block text-[11px]">{editingTool==="legend"?"รายการสัญลักษณ์ (หนึ่งบรรทัดต่อรายการ)":"ข้อความ"}<textarea className="mt-1 min-h-16 w-full rounded-md border border-input p-2 text-xs" maxLength={1000} value={text} onChange={event=>onText(event.target.value)} placeholder="พิมพ์ข้อความ…"/></label>}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px]">สี<Input type="color" className="mt-1 h-8 p-1" value={style.color} onChange={e=>onStyle({...style,color:e.target.value})}/></label>
          <label className="text-[11px]">ขนาดเส้น<Input type="number" min={1} max={40} className={fieldClass+" mt-1"} value={style.width} onChange={e=>onStyle({...style,width:Math.min(40,Math.max(1,Number(e.target.value)))})}/></label>
        </div>
        <label className="block text-[11px]">ความโปร่งใส {Math.round((1-style.opacity)*100)}%<input className="mt-1 w-full" type="range" min={0.05} max={1} step={0.05} value={style.opacity} onChange={e=>onStyle({...style,opacity:Number(e.target.value)})}/></label>
        {isText&&<>
          <label className="block text-[11px]">Font<select aria-label="Font" className={fieldClass+" mt-1"} value={style.font} onChange={e=>onStyle({...style,font:e.target.value})}><option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option></select></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-[11px]">Size<Input type="number" min={10} max={96} className={fieldClass+" mt-1"} value={style.fontSize} onChange={e=>onStyle({...style,fontSize:Math.min(96,Math.max(10,Number(e.target.value)))})}/></label><label className="text-[11px]">Rotation (°)<Input type="number" min={-180} max={180} className={fieldClass+" mt-1"} value={style.rotation} onChange={e=>onStyle({...style,rotation:Math.min(180,Math.max(-180,Number(e.target.value)))})}/></label><label className="text-[11px]">Background<Input type="color" className="mt-1 h-8 p-1" value={style.background} onChange={e=>onStyle({...style,background:e.target.value})}/></label><label className="text-[11px]">Border<Input type="color" className="mt-1 h-8 p-1" value={style.border} onChange={e=>onStyle({...style,border:e.target.value})}/></label></div>
          <label className="block text-[11px]">Alignment<select aria-label="Alignment" className={fieldClass+" mt-1"} value={style.alignment} onChange={e=>onStyle({...style,alignment:e.target.value as DrawingStyle["alignment"]})}><option value="left">ซ้าย</option><option value="center">กลาง</option><option value="right">ขวา</option></select></label>
        </>}
      </div>
      <div className="flex gap-1 border-t pt-2"><Button variant="outline" size="icon" aria-label="ย้อนกลับ" title="ย้อนกลับ (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={undo}><Undo2/></Button><Button variant="outline" size="icon" aria-label="ทำซ้ำ" disabled={!canRedo} onClick={redo}><Redo2/></Button><Button variant="outline" size="icon" aria-label="ลบวัตถุที่เลือก" disabled={!selected} onClick={onDelete}><Trash2/></Button></div>
      {children}
      <p role="status" className="text-[11px] text-amber-700">{message}</p>
      <p className="text-[10px] leading-4 text-slate-500">{count} วัตถุ · กดบันทึก My Drawing เพื่อเก็บบนเครื่อง</p>
    </div>
  </section>;
}
