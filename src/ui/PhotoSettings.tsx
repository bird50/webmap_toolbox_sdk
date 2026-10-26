"use client";

import {photoSettingsTh} from "./messages/photoSettings.js";
import {useEffect,useRef,useState} from "react";
import {Dialog} from "radix-ui";
import {ImagePlus,Trash2,X,Settings} from "lucide-react";
import {Button} from "./primitives/button.js";
import {readPhotoGps,type GeotaggedPhoto} from "../core/photo-gps.js";
import {formatPhotoExpiry,type StoredPhoto} from "../storage/photo-storage.js";
import {PublicPhotoShare} from "./PublicPhotoShare.js";
import {Input} from "./primitives/input.js";
import {useToolText} from "./context.js";

export function PhotoSettings({open,onOpenChange,onAdd,storageReady,storageMessage,savedPhotos}:{open:boolean;onOpenChange:(open:boolean)=>void;onAdd:(photos:GeotaggedPhoto[])=>Promise<StoredPhoto[]>;storageReady:boolean;storageMessage:string;savedPhotos:StoredPhoto[]}) {
  const t=useToolText("photoSettings",photoSettingsTh);
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
      <Dialog.Content onInteractOutside={event=>event.preventDefault()} onCloseAutoFocus={event=>{event.preventDefault();document.getElementById("toolbox-my-photos-settings")?.focus();}} className="fixed right-3 top-20 z-50 flex max-h-[calc(100dvh-96px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)] bg-white shadow-2xl outline-none data-[state=closed]:hidden sdk-settings-panel">
        <div className="flex shrink-0 items-start justify-between border-b border-[color:var(--sdk-border,#e2e8f0)] p-4">
          <div><Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><Settings className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</Dialog.Title><Dialog.Description className="mt-1 text-xs text-[color:var(--sdk-muted,#64748b)]">{t.description}</Dialog.Description></div>
          <Dialog.Close asChild><Button variant="ghost" size="icon" className="size-8" aria-label={t.close}><X/></Button></Dialog.Close>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <p className="mb-3 rounded-lg bg-[color:var(--sdk-primary-soft,#f0fdfa)] p-3 text-xs leading-5 text-[color:var(--sdk-primary-strong,#115e59)]">{t.intro}</p>
          {storageMessage&&<p role="status" className="mb-3 text-xs text-[color:var(--sdk-warning,#b45309)]">{storageMessage}</p>}
          {!storageReady&&!storageMessage&&<p role="status" className="mb-3 text-xs text-[color:var(--sdk-muted,#64748b)]">{t.opening}</p>}
          <label htmlFor="toolbox-photo" className="mb-2 flex items-center gap-2 text-xs font-medium"><ImagePlus size={15}/>{t.choose}</label>
          <Input id="toolbox-photo" type="file" multiple disabled={reading||saving} accept="image/jpeg,image/png,image/webp" className="h-auto text-xs file:mr-2 file:rounded file:border-0 file:bg-[color:var(--sdk-surface-muted,#f1f5f9)] file:px-2 file:py-1 file:text-xs" onChange={async e=>{
            setNotice("");
            const selected=Array.from(e.target.files??[]);
            const valid=selected.filter(file=>["image/jpeg","image/png","image/webp"].includes(file.type)&&file.size<=10*1024*1024);
            setError(valid.length<selected.length?t.skipped:"");
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
          <p className="mt-2 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.formats}<br/>{t.savedOnAdd}</p>
          {error&&<p role="alert" className="mt-2 text-xs text-[color:var(--sdk-danger,#dc2626)]">{error}</p>}
          <p role="status" className="mt-3 text-xs text-[color:var(--sdk-muted,#64748b)]">{t.selected(photos.length)}</p>
          <p role="status" className="mt-2 text-[11px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{reading?t.reading:t.gpsSummary(ready.length,photos.length-ready.length)}<br/>{t.gpsOnly}</p>
          <Button className="mt-3 w-full" disabled={reading||saving||!storageReady||!ready.length} onClick={async()=>{
            setSaving(true);setError("");setNotice("");
            try {
              const stored=await onAdd(ready.flatMap(photo=>photo.gps?[{file:photo.file,...photo.gps}]:[]));
              setNotice(t.saved(stored.length,formatPhotoExpiry(stored[0].expiresAt)));
              ready.forEach(photo=>{URL.revokeObjectURL(photo.url);objectUrls.current.delete(photo.url);});
              setPhotos(current=>current.filter(photo=>!ready.some(added=>added.url===photo.url)));
            } catch {
              setError(t.saveFailed);
            } finally {setSaving(false);}
          }}>{saving?t.saving:t.add}</Button>
          {notice&&<p role="status" className="mt-2 text-xs text-[color:var(--sdk-primary,#0f766e)]">{notice}</p>}
          {photos.map(({file,url,gps})=><div key={url} className="mt-3 overflow-hidden rounded-lg border border-[color:var(--sdk-border,#e2e8f0)]">
            {/* Local object URLs are used only for previewing the selected file. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={t.previewAlt(file.name)} className="max-h-52 w-full object-contain bg-[color:var(--sdk-surface-subtle,#f8fafc)]" onError={()=>setError(t.previewFailed(file.name))}/>
            <p className={`px-2 pt-2 text-[11px] ${gps?"text-[color:var(--sdk-primary,#0f766e)]":"text-[color:var(--sdk-warning,#b45309)]"}`}>{gps?t.gps(gps.latitude.toFixed(6),gps.longitude.toFixed(6)):t.noGps}</p>
            <p className="px-2 pt-1 text-[11px] text-[color:var(--sdk-muted,#64748b)]">{t.capturedAt} {gps?.capturedAt?.replace("T"," ")??t.noCapturedAt} {gps?.capturedOffset??""}</p>
            <div className="flex items-center gap-2 p-2"><span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--sdk-muted,#64748b)]">{file.name}</span><Button variant="ghost" size="icon" className="size-7" aria-label={t.remove(file.name)} onClick={()=>{setPhotos(current=>current.filter(photo=>photo.url!==url));URL.revokeObjectURL(url);objectUrls.current.delete(url);setError("");}}><Trash2/></Button></div>
          </div>)}
          <PublicPhotoShare photos={savedPhotos}/>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
