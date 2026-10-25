"use client";

import {useState,type RefObject} from "react";
import {Dialog} from "radix-ui";
import {Camera,RotateCcw,Search,X} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {emptyPublicPhotoFilters,publicPhotoFilters,type PublicPhotoFilters} from "../core/public-photo-query.js";

export function PublicPhotoSettings({open,onOpenChange,filters,onApply,returnFocusRef}:{open:boolean;onOpenChange:(open:boolean)=>void;filters:PublicPhotoFilters;onApply:(filters:PublicPhotoFilters)=>void;returnFocusRef:RefObject<HTMLButtonElement|null>}) {
  const [draft,setDraft]=useState(filters);
  const [error,setError]=useState("");
  return <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <Dialog.Portal><Dialog.Content onInteractOutside={event=>event.preventDefault()} onCloseAutoFocus={event=>{event.preventDefault();returnFocusRef.current?.focus();}} className="fixed right-3 top-20 z-50 flex max-h-[calc(100dvh-96px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none sdk-settings-panel">
      <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-4"><div><Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4 text-sky-600"/>ตั้งค่า Public Photos</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-slate-500">ค้นหาภาพสาธารณะในพื้นที่แผนที่ปัจจุบัน</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" className="size-8" aria-label="ปิดการตั้งค่า Public Photos"><X/></Button></Dialog.Close></div>
      <form className="space-y-4 overflow-y-auto p-4" onSubmit={event=>{
        event.preventDefault();const parsed=publicPhotoFilters.safeParse(draft);
        if(!parsed.success){setError(parsed.error.issues[0]?.message??"กรุณาตรวจสอบเงื่อนไขค้นหา");return;}
        setError("");onApply(parsed.data);onOpenChange(false);
      }}>
        <div><label htmlFor="public-photo-username" className="mb-1 block text-xs font-medium">ชื่อผู้ใช้ที่แชร์ภาพ</label><Input id="public-photo-username" maxLength={100} placeholder="ค้นหาจาก username" value={draft.username} onChange={event=>setDraft({...draft,username:event.target.value})}/></div>
        <div><label htmlFor="public-photo-event" className="mb-1 block text-xs font-medium">ชื่อเหตุการณ์</label><Input id="public-photo-event" maxLength={160} placeholder="เช่น น้ำท่วม" value={draft.eventName} onChange={event=>setDraft({...draft,eventName:event.target.value})}/></div>
        <fieldset><legend className="mb-2 text-xs font-medium">วันที่ถ่ายภาพ</legend><div className="grid grid-cols-2 gap-3"><div><label htmlFor="public-photo-start" className="mb-1 block text-[11px] text-slate-500">วันเริ่มต้น</label><Input id="public-photo-start" type="date" value={draft.startDate} max={draft.endDate||undefined} onChange={event=>setDraft({...draft,startDate:event.target.value})}/></div><div><label htmlFor="public-photo-end" className="mb-1 block text-[11px] text-slate-500">วันสิ้นสุด</label><Input id="public-photo-end" type="date" value={draft.endDate} min={draft.startDate||undefined} onChange={event=>setDraft({...draft,endDate:event.target.value})}/></div></div><p className="mt-2 text-[10px] leading-5 text-slate-500">รวมทั้งวันเริ่มต้นและวันสิ้นสุด อ้างอิงวันที่ใน EXIF ตามเวลาของกล้อง</p></fieldset>
        <div><label htmlFor="public-photo-tag" className="mb-1 block text-xs font-medium">Tag</label><Input id="public-photo-tag" maxLength={50} placeholder="เช่น น้ำท่วม หรือ share2026-10-19" value={draft.tag} onChange={event=>setDraft({...draft,tag:event.target.value})}/><p className="mt-1 text-[10px] text-slate-500">ตรงกับแท็กทั้งคำ ไม่ต้องใส่ #</p></div>
        <p className="text-[11px] leading-5 text-slate-500">กรอกเฉพาะเงื่อนไขที่ต้องการ ระบบจะค้นหาภาพที่ตรงอย่างน้อยหนึ่งเงื่อนไข (OR) ชื่อผู้ใช้และเหตุการณ์ค้นหาบางส่วนได้</p>
        {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>{setDraft(emptyPublicPhotoFilters);setError("");onApply(emptyPublicPhotoFilters);}}><RotateCcw/>ล้างเงื่อนไข</Button><Button className="flex-1"><Search/>ค้นหาภาพ</Button></div>
      </form>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
