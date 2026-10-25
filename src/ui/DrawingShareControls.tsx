"use client";
import {useToolbox} from "./context.js";
import {useState} from "react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {drawingShareSchema} from "../core/drawing-contract.js";
import type {Drawing} from "../core/drawing.js";
export function DrawingShareControls({drawings,selected,ready,onSave,storageMessage}:{drawings:Drawing[];selected?:Drawing;ready:boolean;onSave:()=>Promise<void>;storageMessage:string}){
 const {client}=useToolbox();
 const [name,setName]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState(false);
 return <section className="space-y-2 border-t pt-3" aria-label="บันทึกและแชร์รูปวาด">
 <Button size="sm" className="w-full" disabled={!ready||busy} onClick={async()=>{setBusy(true);try{await onSave();}finally{setBusy(false);}}}>บันทึก My Drawing</Button>
 <p role="status" className="text-[11px] text-slate-600">{storageMessage}</p>
 <form className="space-y-2" onSubmit={async event=>{
 event.preventDefault();setError(false);setMessage("");
 const parsed=drawingShareSchema.safeParse({name,drawings:selected?[selected]:drawings});
 if(!parsed.success){setError(true);setMessage("ระบุชื่อ และเลือก 1–100 วัตถุ รวมไม่เกิน 20,000 จุด พิกัดต้องอยู่ใน WGS84");return;}
 const body=JSON.stringify(parsed.data);if(new Blob([body]).size>1024*1024){setError(true);setMessage("ข้อมูลเกิน 1 MB กรุณาเลือกวัตถุน้อยลง");return;}
 setBusy(true);try{const response=await client.request("drawingShares",{method:"POST",headers:{"Content-Type":"application/json"},body});const result=await response.json();if(!response.ok)throw new Error(result.error||"แชร์ไม่สำเร็จ");setMessage(`แชร์ Public แล้ว ${result.count} วัตถุ เปิด Layer Public Drawing เพื่อดู`);client.notify("drawings");}catch(error){setError(true);setMessage(error instanceof Error?error.message:"แชร์ไม่สำเร็จ");}finally{setBusy(false);}
 }}>
 <label htmlFor="drawing-share-name" className="block text-[11px]">ชื่อชุดรูปวาด Public</label><Input id="drawing-share-name" value={name} maxLength={160} required disabled={busy} onChange={event=>setName(event.target.value)}/>
 <p className="text-[10px] text-slate-500">{selected?"แชร์เฉพาะวัตถุที่เลือก":"แชร์ทุกวัตถุใน My Drawing"} · ทุกคนจะเห็นรูปวาด ข้อความ และพิกัด การแก้ไขบนเครื่องไม่เปลี่ยนสำเนา Public</p>
 <Button size="sm" className="w-full" disabled={!ready||busy||!drawings.length}>{busy?"กำลังดำเนินการ…":"Save & Share Public"}</Button>
 </form>{message&&<p role={error?"alert":"status"} className={`text-[11px] ${error?"text-red-600":"text-teal-700"}`}>{message}</p>}
 </section>;
}
