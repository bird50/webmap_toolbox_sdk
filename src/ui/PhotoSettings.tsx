"use client";

import {useEffect,useRef,useState} from "react";
import {Dialog} from "radix-ui";
import {ImagePlus,Trash2,X,Settings} from "lucide-react";
import {Button} from "./primitives/button.js";
import {readPhotoGps,type GeotaggedPhoto} from "../core/photo-gps.js";
import {formatPhotoExpiry,type StoredPhoto} from "../storage/photo-storage.js";
import {PublicPhotoShare} from "./PublicPhotoShare.js";
import {Input} from "./primitives/input.js";

export function PhotoSettings({open,onOpenChange,onAdd,storageReady,storageMessage,savedPhotos}:{open:boolean;onOpenChange:(open:boolean)=>void;onAdd:(photos:GeotaggedPhoto[])=>Promise<StoredPhoto[]>;storageReady:boolean;storageMessage:string;savedPhotos:StoredPhoto[]}) {
  const objectUrls=useRef(new Set<string>());
  const [photos,setPhotos]=useState<{file:File;url:string;gps:{longitude:number;latitude:number;capturedAt:string|null;capturedOffset:string|null}|null}[]>([]);
  const [saving,setSaving]=useState(false);
  const [reading,setReading]=useState(false);
  const ready=photos.filter(photo=>photo.gps!==null);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    const urls=objectUrls.current;
    return ()=>{urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();};
  },[]);


  return <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <Dialog.Portal>
      <Dialog.Content onInteractOutside={event=>event.preventDefault()} onCloseAutoFocus={event=>{event.preventDefault();document.getElementById("toolbox-my-photos-settings")?.focus();}} className="fixed right-3 top-20 z-50 flex max-h-[calc(100dvh-96px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none data-[state=closed]:hidden sdk-settings-panel">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-4">
          <div><Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><Settings className="size-4 text-teal-700"/>จัดการ My Photos</Dialog.Title><Dialog.Description className="mt-1 text-xs text-slate-500">อ่านพิกัด GPS จาก EXIF ของแต่ละภาพโดยอัตโนมัติ</Dialog.Description></div>
          <Dialog.Close asChild><Button variant="ghost" size="icon" className="size-8" aria-label="ปิดการจัดการ My Photos"><X/></Button></Dialog.Close>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <p className="mb-3 rounded-lg bg-teal-50 p-3 text-xs leading-5 text-teal-800">รูปที่กด Add to My Photos จะเก็บบนเบราว์เซอร์นี้ 15 วัน ไม่อัปโหลดไปเซิร์ฟเวอร์ การล้างข้อมูลเว็บไซต์อาจทำให้รูปหายก่อนกำหนด อัปโหลดเฉพาะรูปที่เลือกเมื่อกด Save & Share Public</p>
          {storageMessage&&<p role="status" className="mb-3 text-xs text-amber-700">{storageMessage}</p>}
          {!storageReady&&!storageMessage&&<p role="status" className="mb-3 text-xs text-slate-500">กำลังเปิดที่เก็บรูปบนเครื่อง…</p>}
          <label htmlFor="toolbox-photo" className="mb-2 flex items-center gap-2 text-xs font-medium"><ImagePlus size={15}/>เลือกภาพถ่าย</label>
          <Input id="toolbox-photo" type="file" multiple disabled={reading||saving} accept="image/jpeg,image/png,image/webp" className="h-auto text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" onChange={async e=>{
            setNotice("");
            const selected=Array.from(e.target.files??[]);
            const valid=selected.filter(file=>["image/jpeg","image/png","image/webp"].includes(file.type)&&file.size<=10*1024*1024);
            setError(valid.length<selected.length?"ข้ามไฟล์ที่ไม่รองรับหรือมีขนาดเกิน 10 MB ต่อรูปแล้ว":"");
            e.target.value="";
            setReading(true);
            try {
              const added:typeof photos=[];
              for(const file of valid){
                const gps=await readPhotoGps(file);
                const url=URL.createObjectURL(file);
                objectUrls.current.add(url);
                added.push({file,url,gps});
              }
              setPhotos(current=>[...current,...added]);
            } finally {
              setReading(false);
            }
          }}/>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">เลือกหลายรูปได้ · JPG, PNG, WebP · ไม่เกิน 10 MB ต่อรูป<br/>บันทึกบนเครื่องเมื่อกด Add to My Photos</p>
          {error&&<p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
          <p role="status" className="mt-3 text-xs text-slate-500">เลือกแล้ว {photos.length} รูป</p>
          <p role="status" className="mt-2 text-[11px] leading-5 text-slate-500">{reading?"กำลังอ่านพิกัดจากรูป…":`มีพิกัด ${ready.length} รูป · ไม่มีพิกัดหรืออ่านไม่ได้ ${photos.length-ready.length} รูป`}<br/>เพิ่มเฉพาะภาพที่มีพิกัด GPS ที่ถูกต้อง</p>
          <Button className="mt-3 w-full" disabled={reading||saving||!storageReady||!ready.length} onClick={async()=>{
            setSaving(true);setError("");setNotice("");
            try {
              const stored=await onAdd(ready.flatMap(photo=>photo.gps?[{file:photo.file,...photo.gps}]:[]));
              setNotice(`บันทึก ${stored.length} รูปบนเครื่องแล้ว เก็บถึง ${formatPhotoExpiry(stored[0].expiresAt)} (15 วัน)`);
              ready.forEach(photo=>{URL.revokeObjectURL(photo.url);objectUrls.current.delete(photo.url);});
              setPhotos(current=>current.filter(photo=>!ready.some(added=>added.url===photo.url)));
            } catch {
              setError("บันทึกรูปไม่สำเร็จ พื้นที่อาจเต็มหรือเบราว์เซอร์ไม่อนุญาต กรุณาตรวจสอบพื้นที่แล้วลองใหม่ รูปที่เลือกยังอยู่");
            } finally {setSaving(false);}
          }}>{saving?"กำลังบันทึก…":"Add to My Photos"}</Button>
          {notice&&<p role="status" className="mt-2 text-xs text-teal-700">{notice}</p>}
          {photos.map(({file,url,gps})=><div key={url} className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            {/* Local object URLs are used only for previewing the selected file. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`ภาพตัวอย่าง ${file.name}`} className="max-h-52 w-full object-contain bg-slate-50" onError={()=>setError(`ไม่สามารถแสดงภาพ ${file.name} ได้ กรุณาเลือกภาพอื่น`)}/>
            <p className={`px-2 pt-2 text-[11px] ${gps?"text-teal-700":"text-amber-700"}`}>{gps?`GPS: ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`:"ไม่พบพิกัด GPS หรืออ่านไม่ได้ — ไม่เพิ่มลงแผนที่"}</p>
            <p className="px-2 pt-1 text-[11px] text-slate-500">วันที่ถ่าย: {gps?.capturedAt?.replace("T"," ")??"ไม่พบวันที่ถ่ายใน EXIF (เก็บบนเครื่องได้ แต่แชร์ Public ไม่ได้)"} {gps?.capturedOffset??""}</p>
            <div className="flex items-center gap-2 p-2"><span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{file.name}</span><Button variant="ghost" size="icon" className="size-7" aria-label={`นำภาพ ${file.name} ออก`} onClick={()=>{setPhotos(current=>current.filter(photo=>photo.url!==url));URL.revokeObjectURL(url);objectUrls.current.delete(url);setError("");}}><Trash2/></Button></div>
          </div>)}
          <PublicPhotoShare photos={savedPhotos}/>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
