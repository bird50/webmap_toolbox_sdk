"use client";

import {useToolbox,useToolMessages} from "./context.js";
import {useState} from "react";
import {LockKeyhole,Share2} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import type {StoredPhoto} from "../storage/photo-storage.js";
import {automaticShareTag,MAX_SHARE_BYTES,MAX_SHARE_PHOTOS,shareFields} from "../core/photo-share.js";

export function PublicPhotoShare({photos}:{photos:StoredPhoto[]}) {
 const {client}=useToolbox();
 const t=useToolMessages().publicPhotoShare;
  const [selected,setSelected]=useState<string[]>([]);
  const [eventName,setEventName]=useState("");
  const [tags,setTags]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [shared,setShared]=useState<{url:string;tags:string[]}|null>(null);
  const [autoTag]=useState(()=>automaticShareTag());
  const chosen=photos.filter(photo=>selected.includes(photo.id));
  return <section className="mt-6 border-t border-[color:var(--sdk-border,#e2e8f0)] pt-4" aria-labelledby="public-share-title">
    <h3 id="public-share-title" className="flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</h3>
    <p className="mt-2 text-xs leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.intro}</p>
    <form className="mt-3 space-y-3" onSubmit={async event=>{
      event.preventDefault();setError("");setShared(null);
      const fields=shareFields.safeParse({eventName,tags:tags.split(",").map(tag=>tag.trim()).filter(Boolean)});
      if(!fields.success){setError(t.invalidFields);return;}
      if(!chosen.length||chosen.length>MAX_SHARE_PHOTOS){setError(t.pickCount);return;}
      if(chosen.reduce((sum,photo)=>sum+photo.blob.size,0)>MAX_SHARE_BYTES-65536){setError(t.tooLarge);return;}
      const body=new FormData();body.set("eventName",fields.data.eventName);body.set("tags",JSON.stringify(fields.data.tags));
      chosen.forEach(photo=>body.append("photos",photo.blob,photo.name));
      setBusy(true);
      try {
        const response=await client.request("photoShares",{method:"POST",body});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||t.failed);
        setShared({url:client.url(result.url),tags:result.tags});
        client.notify("photos");
      } catch(error){setError(error instanceof Error?error.message:t.failedRetry);}
      finally {setBusy(false);}
    }}>
      <div><label htmlFor="photo-event-name" className="mb-1 block text-xs font-medium">{t.event}</label><Input id="photo-event-name" required maxLength={160} value={eventName} disabled={busy} onChange={event=>setEventName(event.target.value)} placeholder={t.eventPlaceholder}/></div>
      <div><p className="mb-1 text-xs font-medium">{t.autoTag}</p><span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--sdk-primary-soft,#f0fdfa)] px-2 py-1 text-xs text-[color:var(--sdk-primary,#0f766e)]"><LockKeyhole size={12}/>{autoTag}</span><p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.autoTagHint}</p></div>
      <div><label htmlFor="photo-share-tags" className="mb-1 block text-xs font-medium">{t.tags}</label><Input id="photo-share-tags" value={tags} disabled={busy} maxLength={510} onChange={event=>setTags(event.target.value)} placeholder={t.tagsPlaceholder}/></div>
      <fieldset disabled={busy} className="max-h-48 overflow-auto rounded-lg border border-[color:var(--sdk-border,#e2e8f0)] p-3"><legend className="px-1 text-xs font-medium">{t.photos(chosen.length,MAX_SHARE_PHOTOS)}</legend>{photos.length?photos.map(photo=><label key={photo.id} className="flex items-start gap-2 py-1.5 text-xs"><input type="checkbox" checked={selected.includes(photo.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,photo.id]:current.filter(id=>id!==photo.id))} className="mt-0.5 accent-[color:var(--sdk-primary,#0f766e)]"/><span className="min-w-0 break-words">{photo.name}<small className="mt-1 block text-[10px] text-[color:var(--sdk-muted,#64748b)]">{photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)} · {t.checkDate}</small></span></label>):<p className="text-xs text-[color:var(--sdk-muted,#64748b)]">{t.empty}</p>}</fieldset>
      <p className="text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.limits}</p>
      <Button className="w-full" disabled={busy||!chosen.length}><Share2/>{busy?t.saving:t.save}</Button>
      {error&&<p role="alert" className="text-xs text-[color:var(--sdk-danger,#dc2626)]">{error}</p>}
      {shared&&<div role="status" className="rounded-lg bg-[color:var(--sdk-primary-soft,#f0fdfa)] p-3 text-xs leading-5 text-[color:var(--sdk-primary-strong,#115e59)]"><p>{t.shared(shared.tags.join(", "))}</p><a className="mt-1 block break-all font-semibold underline" href={shared.url} target="_blank" rel="noopener noreferrer">{t.open}</a><p className="mt-1 break-all">{shared.url}</p></div>}
    </form>
  </section>;
}
