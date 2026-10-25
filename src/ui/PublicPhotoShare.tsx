"use client";

import {useToolbox} from "./context.js";
import {useState} from "react";
import {LockKeyhole,Share2} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import type {StoredPhoto} from "../storage/photo-storage.js";
import {automaticShareTag,MAX_SHARE_BYTES,MAX_SHARE_PHOTOS,shareFields} from "../core/photo-share.js";

export function PublicPhotoShare({photos}:{photos:StoredPhoto[]}) {
 const {client}=useToolbox();
  const [selected,setSelected]=useState<string[]>([]);
  const [eventName,setEventName]=useState("");
  const [tags,setTags]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [shared,setShared]=useState<{url:string;tags:string[]}|null>(null);
  const [autoTag]=useState(()=>automaticShareTag());
  const chosen=photos.filter(photo=>selected.includes(photo.id));
  return <section className="mt-6 border-t border-slate-200 pt-4" aria-labelledby="public-share-title">
    <h3 id="public-share-title" className="flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4 text-teal-700"/>บันทึกเพื่อแชร์ Public</h3>
    <p className="mt-2 text-xs leading-5 text-slate-500">อัปโหลดภาพที่เลือกขึ้นเซิร์ฟเวอร์ ทุกคนที่มีลิงก์จะดูภาพ พิกัด และวันที่ถ่ายได้ ภาพ Public ไม่หมดอายุตามข้อมูลบนเครื่อง 15 วัน</p>
    <form className="mt-3 space-y-3" onSubmit={async event=>{
      event.preventDefault();setError("");setShared(null);
      const fields=shareFields.safeParse({eventName,tags:tags.split(",").map(tag=>tag.trim()).filter(Boolean)});
      if(!fields.success){setError("ระบุชื่อเหตุการณ์ และแท็กไม่เกิน 10 แท็ก แท็กละไม่เกิน 50 ตัวอักษร ห้ามกำหนดแท็ก shareYYYY-MM-DD เอง");return;}
      if(!chosen.length||chosen.length>MAX_SHARE_PHOTOS){setError("เลือกภาพ 1–10 รูปจาก My Photos");return;}
      if(chosen.reduce((sum,photo)=>sum+photo.blob.size,0)>MAX_SHARE_BYTES-65536){setError("ไฟล์ภาพรวมต้องไม่เกิน 25 MB");return;}
      const body=new FormData();body.set("eventName",fields.data.eventName);body.set("tags",JSON.stringify(fields.data.tags));
      chosen.forEach(photo=>body.append("photos",photo.blob,photo.name));
      setBusy(true);
      try {
        const response=await client.request("photoShares",{method:"POST",body});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||"แชร์ภาพไม่สำเร็จ");
        setShared({url:client.url(result.url),tags:result.tags});
        client.notify("photos");
      } catch(error){setError(error instanceof Error?error.message:"แชร์ภาพไม่สำเร็จ กรุณาลองใหม่");}
      finally {setBusy(false);}
    }}>
      <div><label htmlFor="photo-event-name" className="mb-1 block text-xs font-medium">ชื่อเหตุการณ์</label><Input id="photo-event-name" required maxLength={160} value={eventName} disabled={busy} onChange={event=>setEventName(event.target.value)} placeholder="เช่น น้ำท่วมบริเวณสะพาน"/></div>
      <div><p className="mb-1 text-xs font-medium">แท็กอัตโนมัติ (แก้ไขไม่ได้)</p><span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-1 text-xs text-teal-700"><LockKeyhole size={12}/>{autoTag}</span><p className="mt-1 text-[10px] text-slate-500">ระบบกำหนดตามวันที่บันทึกจริง เวลาไทย</p></div>
      <div><label htmlFor="photo-share-tags" className="mb-1 block text-xs font-medium">แท็กเพิ่มเติม (คั่นด้วย ,)</label><Input id="photo-share-tags" value={tags} disabled={busy} maxLength={510} onChange={event=>setTags(event.target.value)} placeholder="น้ำท่วม, เฝ้าระวัง"/></div>
      <fieldset disabled={busy} className="max-h-48 overflow-auto rounded-lg border border-slate-200 p-3"><legend className="px-1 text-xs font-medium">ภาพจาก My Photos · เลือกแล้ว {chosen.length}/{MAX_SHARE_PHOTOS}</legend>{photos.length?photos.map(photo=><label key={photo.id} className="flex items-start gap-2 py-1.5 text-xs"><input type="checkbox" checked={selected.includes(photo.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,photo.id]:current.filter(id=>id!==photo.id))} className="mt-0.5 accent-teal-700"/><span className="min-w-0 break-words">{photo.name}<small className="mt-1 block text-[10px] text-slate-500">{photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)} · ตรวจวันที่ถ่ายจากไฟล์ก่อนบันทึก</small></span></label>):<p className="text-xs text-slate-500">เพิ่มรูปลง My Photos ก่อนเลือกแชร์</p>}</fieldset>
      <p className="text-[10px] leading-5 text-slate-500">ครั้งละไม่เกิน 10 รูป รวมไม่เกิน 25 MB แต่ละรูปต้องมี GPS และวันที่ถ่ายใน EXIF</p>
      <Button className="w-full" disabled={busy||!chosen.length}><Share2/>{busy?"กำลังบันทึก Public…":"Save & Share Public"}</Button>
      {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}
      {shared&&<div role="status" className="rounded-lg bg-teal-50 p-3 text-xs leading-5 text-teal-800"><p>บันทึก Public แล้ว · {shared.tags.join(", ")}</p><a className="mt-1 block break-all font-semibold underline" href={shared.url} target="_blank" rel="noopener noreferrer">เปิดลิงก์ Public</a><p className="mt-1 break-all">{shared.url}</p></div>}
    </form>
  </section>;
}
