"use client";

import {photoSettingsTh} from "./messages/photoSettings.js";
import {useEffect,useRef,useState} from "react";
import {ImagePlus,Trash2} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {useToolText} from "./context.js";
import {readPhotoGps,type GeotaggedPhoto} from "../core/photo-gps.js";
import {MAX_PHOTO_CAPTION} from "../core/photo-share.js";

type Pick={file:File;url:string;caption:string;gps:{longitude:number;latitude:number;capturedAt:string|null;capturedOffset:string|null}|null};
const ACCEPTED=["image/jpeg","image/png","image/webp"];

/** Files chosen in a photo form: GPS read from EXIF, a caption each, preview URLs revoked when removed or unmounted. */
export function usePhotoPicks(){
  const t=useToolText("photoSettings",photoSettingsTh);
  const urls=useRef(new Set<string>());
  const [picks,setPicks]=useState<Pick[]>([]);
  const [reading,setReading]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{const current=urls.current;return ()=>{current.forEach(url=>URL.revokeObjectURL(url));current.clear();};},[]);
  const drop=(url:string)=>{URL.revokeObjectURL(url);urls.current.delete(url);};
  async function addFiles(files:File[]){
    const valid=files.filter(file=>ACCEPTED.includes(file.type)&&file.size<=10*1024*1024);
    setError(valid.length<files.length?t.skipped:"");
    setReading(true);
    try{
      const added:Pick[]=[];
      for(const file of valid){const gps=await readPhotoGps(file),url=URL.createObjectURL(file);urls.current.add(url);added.push({file,url,gps,caption:""});}
      setPicks(current=>[...current,...added]);
    }finally{setReading(false);}
  }
  const ready=picks.filter(pick=>pick.gps!==null);
  return {
    picks,reading,error,setError,ready:ready.length,
    /** Photos with GPS, ready to store. */
    photos:():(GeotaggedPhoto&{caption:string})[]=>ready.flatMap(pick=>pick.gps?[{file:pick.file,...pick.gps,caption:pick.caption}]:[]),
    addFiles,
    setCaption:(url:string,caption:string)=>setPicks(current=>current.map(pick=>pick.url===url?{...pick,caption}:pick)),
    remove:(url:string)=>{setPicks(current=>current.filter(pick=>pick.url!==url));drop(url);setError("");},
    clear:()=>{picks.forEach(pick=>drop(pick.url));setPicks([]);setError("");},
  };
}
export type PhotoPicks=ReturnType<typeof usePhotoPicks>;

/** File input, GPS summary and one preview card (GPS, capture date, caption) per chosen file. */
export function PhotoPicker({picks,id,disabled}:{picks:PhotoPicks;id:string;disabled?:boolean}){
  const t=useToolText("photoSettings",photoSettingsTh);
  return <div>
    <label htmlFor={id} className="mb-2 flex items-center gap-2 text-xs font-medium"><ImagePlus size={15}/>{t.choose}</label>
    <Input id={id} type="file" multiple disabled={disabled||picks.reading} accept={ACCEPTED.join(",")} className="h-auto text-xs file:mr-2 file:rounded file:border-0 file:bg-[color:var(--sdk-surface-muted,#f1f5f9)] file:px-2 file:py-1 file:text-xs" onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value="";void picks.addFiles(files);}}/>
    <p className="mt-2 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.formats}</p>
    {picks.error&&<p role="alert" className="mt-2 text-xs text-[color:var(--sdk-danger,#dc2626)]">{picks.error}</p>}
    {(picks.picks.length>0||picks.reading)&&<p role="status" className="mt-2 text-[11px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{picks.reading?t.reading:t.gpsSummary(picks.ready,picks.picks.length-picks.ready)}<br/>{t.gpsOnly}</p>}
    {picks.picks.map(({file,url,gps,caption},index)=><div key={url} className="mt-3 overflow-hidden rounded-lg border border-[color:var(--sdk-border,#e2e8f0)]">
      {/* Local object URLs are used only for previewing the selected file. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={t.previewAlt(file.name)} className="max-h-52 w-full object-contain bg-[color:var(--sdk-surface-subtle,#f8fafc)]" onError={()=>picks.setError(t.previewFailed(file.name))}/>
      <p className={`px-2 pt-2 text-[11px] ${gps?"text-[color:var(--sdk-primary,#0f766e)]":"text-[color:var(--sdk-warning,#b45309)]"}`}>{gps?t.gps(gps.latitude.toFixed(6),gps.longitude.toFixed(6)):t.noGps}</p>
      <p className="px-2 pt-1 text-[11px] text-[color:var(--sdk-muted,#64748b)]">{t.capturedAt} {gps?.capturedAt?.replace("T"," ")??t.noCapturedAt} {gps?.capturedOffset??""}</p>
      {gps&&<div className="px-2 pt-2"><label htmlFor={`${id}-caption-${index}`} className="mb-1 block text-[11px] font-medium">{t.caption}</label><textarea id={`${id}-caption-${index}`} rows={2} maxLength={MAX_PHOTO_CAPTION} value={caption} disabled={disabled} placeholder={t.captionPlaceholder} onChange={event=>picks.setCaption(url,event.target.value)} className="w-full resize-y rounded-md border border-[color:var(--sdk-border,#e2e8f0)] px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sdk-ring,#0d9488)]"/></div>}
      <div className="flex items-center gap-2 p-2"><span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--sdk-muted,#64748b)]">{file.name}</span><Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t.remove(file.name)} disabled={disabled} onClick={()=>picks.remove(url)}><Trash2/></Button></div>
    </div>)}
  </div>;
}
