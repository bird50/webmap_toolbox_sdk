"use client";
import {dataFileShareTh} from "./messages/dataFileShare.js";
import {useId,useState} from "react";
import {LockKeyhole,Share2} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {useToolbox,useToolText} from "./context.js";
import type {StoredDataFile} from "../storage/data-file-storage.js";
import {automaticShareTag} from "../core/share-tags.js";
import {dataFileShareFields,MAX_DATA_SHARE_BYTES} from "../core/data-file-share.js";

/** Publishes one stored data file through the gateway with a name, description and tags. */
export function DataFileShare({file,onClose,onShared}:{file:StoredDataFile;onClose:()=>void;onShared?:()=>void}){
 const {client}=useToolbox();
 const t=useToolText("dataFileShare",dataFileShareTh),id=useId();
 const [name,setName]=useState(()=>file.name.replace(/\.[^.]+$/,""));
 const [description,setDescription]=useState(file.description);
 const [tags,setTags]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [shared,setShared]=useState<{count:number;tags:string[]}|null>(null);
 const [autoTag]=useState(()=>automaticShareTag());
 return <form aria-label={t.title} className="mt-3 space-y-3 border-t border-[color:var(--sdk-border-subtle,#f1f5f9)] pt-3" onSubmit={async event=>{
  event.preventDefault();setError("");setShared(null);
  const fields=dataFileShareFields.safeParse({name,description,tags:tags.split(",").map(tag=>tag.trim()).filter(Boolean)});
  if(!fields.success){setError(t.invalidFields);return;}
  const body=JSON.stringify({...fields.data,data:file.data});
  if(new TextEncoder().encode(body).length>MAX_DATA_SHARE_BYTES){setError(t.tooLarge);return;}
  setBusy(true);
  try{
   const response=await client.request("dataFileShares",{method:"POST",headers:{"content-type":"application/json"},body});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||t.failed);
   setShared({count:result.count,tags:result.tags});
   client.notify("dataFiles");onShared?.();
  }catch(error){setError(error instanceof Error&&error.message?error.message:t.failed);}
  finally{setBusy(false);}
 }}>
  <div><h4 className="flex items-center gap-2 text-xs font-semibold"><Share2 className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</h4><p className="mt-1 text-[11px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.intro}</p></div>
  <div><label htmlFor={`${id}-name`} className="mb-1 block text-xs font-medium">{t.name}</label><Input id={`${id}-name`} required maxLength={160} value={name} disabled={busy} placeholder={t.namePlaceholder} onChange={event=>setName(event.target.value)} className="h-9 text-xs"/></div>
  <div><label htmlFor={`${id}-description`} className="mb-1 block text-xs font-medium">{t.description}</label><textarea id={`${id}-description`} maxLength={1000} rows={3} value={description} disabled={busy} placeholder={t.descriptionPlaceholder} onChange={event=>setDescription(event.target.value)} className="w-full rounded-lg border border-[color:var(--sdk-border,#e2e8f0)] p-2 text-xs"/></div>
  <div><p className="mb-1 text-xs font-medium">{t.autoTag}</p><span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--sdk-primary-soft,#f0fdfa)] px-2 py-1 text-xs text-[color:var(--sdk-primary,#0f766e)]"><LockKeyhole size={12}/>{autoTag}</span><p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.autoTagHint}</p></div>
  <div><label htmlFor={`${id}-tags`} className="mb-1 block text-xs font-medium">{t.tags}</label><Input id={`${id}-tags`} maxLength={510} value={tags} disabled={busy} placeholder={t.tagsPlaceholder} onChange={event=>setTags(event.target.value)} className="h-9 text-xs"/></div>
  <p className="text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.limits(file.data.features.length)}</p>
  <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>{t.cancel}</Button><Button size="sm" className="flex-1" disabled={busy}><Share2/>{busy?t.saving:t.save}</Button></div>
  {error&&<p role="alert" className="text-xs text-[color:var(--sdk-danger,#dc2626)]">{error}</p>}
  {shared&&<p role="status" className="rounded-lg bg-[color:var(--sdk-primary-soft,#f0fdfa)] p-3 text-xs leading-5 text-[color:var(--sdk-primary-strong,#115e59)]">{t.shared(shared.count,shared.tags.join(", "))}</p>}
 </form>;
}
