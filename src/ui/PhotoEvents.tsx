"use client";
import {photoEventsTh} from "./messages/photoEvents.js";
import {useState} from "react";
import {CloudUpload,FolderCog,FolderPlus,Images,Minus,Plus,Trash2} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {useToolbox,useToolText} from "./context.js";
import type {PhotoEvent,StoredPhoto} from "../storage/photo-storage.js";
import type {GeotaggedPhoto} from "../core/photo-gps.js";
import {PhotoPicker,usePhotoPicks} from "./PhotoPicker.js";
import {formatExpiry} from "../storage/expiry.js";
import {MAX_PHOTO_CAPTION,MAX_SHARE_BYTES,MAX_SHARE_PHOTOS,shareFields} from "../core/photo-share.js";
import type {PhotoEventActions} from "./plugins/photo.js";

/**
 * Event sets of My Photos: photos are chosen straight into a named set kept in this browser; each set can then be
 * managed (name, tags, photos added as new files, removed and captioned), be added to the map, be saved to Public as one share (its name and
 * tags), or be deleted with its photos. A photo left in no set is deleted.
 */
export function PhotoEvents({photos,events,actions,onAdd,storageReady=true}:{photos:StoredPhoto[];events:PhotoEvent[];actions:PhotoEventActions;onAdd:(photos:(GeotaggedPhoto&{caption?:string})[])=>Promise<StoredPhoto[]>;storageReady?:boolean}){
 const t=useToolText("photoEvents",photoEventsTh);
 const {client}=useToolbox();
 const picks=usePhotoPicks(),morePicks=usePhotoPicks();
 const [name,setName]=useState("");
 const [tags,setTags]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [nameMissing,setNameMissing]=useState(false);
 // The set whose photos are being edited, with the draft selection.
 const [editing,setEditing]=useState<{id:string;name:string;tags:string;photoIds:string[];captions:Record<string,string>}|null>(null);
 async function run(key:string,work:()=>Promise<void>){
  setBusy(key);setError("");setNotice("");
  try{await work();}catch(error){setError(error instanceof Error&&error.message?error.message:t.actionFailed);}finally{setBusy(null);}
 }
 async function share(event:PhotoEvent){
  const items=photos.filter(photo=>event.photoIds.includes(photo.id));
  if(items.reduce((sum,photo)=>sum+photo.blob.size,0)>MAX_SHARE_BYTES-65536)throw new Error(t.tooLarge);
  const body=new FormData();body.set("eventName",event.name);body.set("tags",JSON.stringify(event.tags));
  items.forEach(photo=>body.append("photos",photo.blob,photo.name));
  body.set("captions",JSON.stringify(items.map(photo=>photo.caption??"")));
  const response=await client.request("photoShares",{method:"POST",body});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||t.shareFailed);
  await actions.recordShare(event.id,{url:client.url(result.url),tags:result.tags,sharedAt:Date.now()});
  client.notify("photos");
 }
 return <section className="mt-6 border-t border-[color:var(--sdk-border,#e2e8f0)] pt-4" aria-labelledby="photo-events-title">
  <h3 id="photo-events-title" className="flex items-center gap-2 text-sm font-semibold"><FolderPlus className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</h3>
  <p className="mt-2 text-xs leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.intro}</p>
  <form noValidate className="mt-3 space-y-3" onSubmit={event=>{
   event.preventDefault();
   if(!name.trim()){setNameMissing(true);setError(t.nameRequired);return;}
   const fields=shareFields.safeParse({eventName:name,tags:tags.split(",").map(tag=>tag.trim()).filter(Boolean)});
   if(!fields.success){setError(t.invalidFields);return;}
   if(!picks.ready||picks.ready>MAX_SHARE_PHOTOS){setError(t.pickCount(MAX_SHARE_PHOTOS));return;}
   void run("save",async()=>{
    try{const stored=await onAdd(picks.photos());await actions.save({name:fields.data.eventName,tags:fields.data.tags,photoIds:stored.map(photo=>photo.id)});}catch{throw new Error(t.saveFailed);}
    setNotice(t.saved(fields.data.eventName));setName("");setTags("");picks.clear();
   });
  }}>
   <div><label htmlFor="photo-event-name" className="mb-1 block text-xs font-medium">{t.event}<span aria-hidden="true" className="ml-0.5 text-[color:var(--sdk-danger,#dc2626)]">*</span></label><Input id="photo-event-name" required aria-required="true" aria-invalid={nameMissing||undefined} aria-describedby={nameMissing?"photo-event-name-error":undefined} maxLength={160} value={name} disabled={!!busy} onChange={event=>{setName(event.target.value);if(event.target.value.trim())setNameMissing(false);}} placeholder={t.eventPlaceholder}/>{nameMissing&&<p id="photo-event-name-error" className="mt-1 text-[10px] text-[color:var(--sdk-danger,#dc2626)]">{t.nameRequired}</p>}</div>
   <div><label htmlFor="photo-event-tags" className="mb-1 block text-xs font-medium">{t.tags}</label><Input id="photo-event-tags" value={tags} disabled={!!busy} maxLength={510} onChange={event=>setTags(event.target.value)} placeholder={t.tagsPlaceholder}/><p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.tagsHint}</p></div>
   <PhotoPicker picks={picks} id="toolbox-photo" disabled={!!busy}/>
   <p className="text-[11px] text-[color:var(--sdk-muted,#64748b)]">{t.photos(picks.ready,MAX_SHARE_PHOTOS)}</p>
   <Button className="w-full" disabled={!!busy||!storageReady||picks.reading||!picks.ready}><FolderPlus/>{busy==="save"?t.saving:t.save}</Button>
  </form>
  {error&&<p role="alert" className="mt-2 text-xs text-[color:var(--sdk-danger,#dc2626)]">{error}</p>}
  {notice&&<p role="status" className="mt-2 text-xs text-[color:var(--sdk-primary,#0f766e)]">{notice}</p>}
  <h4 className="mb-2 mt-5 flex items-center gap-2 text-xs font-semibold"><Images className="size-4"/>{t.list(events.length)}</h4>
  {!events.length&&<p className="text-xs text-[color:var(--sdk-muted,#64748b)]">{t.none}</p>}
  {events.map(event=>{
   const items=photos.filter(photo=>event.photoIds.includes(photo.id));
   const expiry=items.length?Math.max(...items.map(photo=>photo.expiresAt)):event.createdAt;
   return <article key={event.id} aria-label={event.name} className={`mt-2 rounded-lg border p-3 ${event.onMap?"border-[color:var(--sdk-primary,#0f766e)] bg-[color:var(--sdk-primary-soft,#f0fdfa)]":"border-[color:var(--sdk-border,#e2e8f0)]"}`}>
    <p className="break-words text-xs font-semibold">{event.name}{event.onMap&&<span className="ml-2 rounded-full bg-[color:var(--sdk-primary,#0f766e)] px-2 py-0.5 text-[10px] font-medium text-white">{t.onMap}</span>}</p>
    {event.tags.length>0&&<p className="mt-1 flex flex-wrap gap-1">{event.tags.map(tag=><span key={tag} className="rounded-full bg-[color:var(--sdk-surface-muted,#f1f5f9)] px-2 py-0.5 text-[10px] text-[color:var(--sdk-muted-strong,#475569)]">{tag}</span>)}</p>}
    <p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.meta(items.length,formatExpiry(expiry))}</p>
    {event.share&&<p role="status" className="mt-1 text-[11px] leading-5 text-[color:var(--sdk-primary-strong,#115e59)]">{t.shared(event.share.tags.join(", "))} · <a className="font-semibold underline" href={event.share.url} target="_blank" rel="noopener noreferrer">{t.open}</a></p>}
    {editing?.id===event.id?<form className="mt-2 space-y-2" aria-label={t.editLabel(event.name)} onSubmit={form=>{
     form.preventDefault();
     if(!editing.name.trim()){setError(t.nameRequired);return;}
     const fields=shareFields.safeParse({eventName:editing.name,tags:editing.tags.split(",").map(tag=>tag.trim()).filter(Boolean)});
     if(!fields.success){setError(t.invalidFields);return;}
     const ids=editing.photoIds.filter(id=>photos.some(photo=>photo.id===id));
     if(!ids.length&&!morePicks.ready||ids.length+morePicks.ready>MAX_SHARE_PHOTOS){setError(t.pickCount(MAX_SHARE_PHOTOS));return;}
     void run(`photos:${event.id}`,async()=>{
      const {eventName:name,tags}=fields.data;
      if(name!==event.name||tags.join("\u0000")!==event.tags.join("\u0000"))await actions.setDetails(event.id,{name,tags});
      for(const id of ids){const caption=(editing.captions[id]??"").trim();if(caption!==(photos.find(photo=>photo.id===id)?.caption??""))await actions.setCaption(id,caption);}
      const added=morePicks.ready?await onAdd(morePicks.photos()):[];
      const next=[...ids,...added.map(photo=>photo.id)];
      await actions.setPhotos(event.id,next);morePicks.clear();setEditing(null);setNotice(t.photosSaved(name,next.length));
     });
    }}>
     <div><label htmlFor={`photo-event-name-${event.id}`} className="mb-1 block text-xs font-medium">{t.event}<span aria-hidden="true" className="ml-0.5 text-[color:var(--sdk-danger,#dc2626)]">*</span></label><Input id={`photo-event-name-${event.id}`} required aria-required="true" maxLength={160} value={editing.name} disabled={!!busy} onChange={change=>{const value=change.target.value;setEditing(current=>current&&{...current,name:value});}}/></div>
     <div><label htmlFor={`photo-event-tags-${event.id}`} className="mb-1 block text-xs font-medium">{t.tags}</label><Input id={`photo-event-tags-${event.id}`} maxLength={510} value={editing.tags} disabled={!!busy} placeholder={t.tagsPlaceholder} onChange={change=>{const value=change.target.value;setEditing(current=>current&&{...current,tags:value});}}/></div>
     <fieldset disabled={!!busy} className="max-h-64 overflow-auto rounded-lg border border-[color:var(--sdk-border,#e2e8f0)] bg-[color:var(--sdk-surface,#fff)] p-2"><legend className="px-1 text-[11px] font-medium">{t.inSet(editing.photoIds.filter(id=>photos.some(photo=>photo.id===id)).length+morePicks.ready,MAX_SHARE_PHOTOS)}</legend>
      {photos.filter(photo=>event.photoIds.includes(photo.id)).map(photo=><div key={photo.id} className="py-1"><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={editing.photoIds.includes(photo.id)} onChange={change=>setEditing(current=>current&&{...current,photoIds:change.target.checked?[...current.photoIds,photo.id]:current.photoIds.filter(id=>id!==photo.id)})} className="mt-0.5 accent-[color:var(--sdk-primary,#0f766e)]"/><span className="min-w-0 break-words">{photo.name}</span></label>
       {editing.photoIds.includes(photo.id)&&<textarea rows={2} maxLength={MAX_PHOTO_CAPTION} aria-label={t.captionLabel(photo.name)} placeholder={t.captionPlaceholder} value={editing.captions[photo.id]??""} onChange={change=>{const value=change.target.value;setEditing(current=>current&&{...current,captions:{...current.captions,[photo.id]:value}});}} className="ml-5 mt-1 w-[calc(100%-1.25rem)] resize-y rounded-md border border-[color:var(--sdk-border,#e2e8f0)] px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sdk-ring,#0d9488)]"/>}
      </div>)}
     </fieldset>
     <div className="rounded-lg border border-dashed border-[color:var(--sdk-border,#e2e8f0)] p-2"><PhotoPicker picks={morePicks} id={`toolbox-photo-${event.id}`} disabled={!!busy}/></div>
     <p className="text-[10px] leading-4 text-[color:var(--sdk-muted,#64748b)]">{t.uncheckHint}</p>
     {event.share&&<p className="text-[10px] leading-4 text-[color:var(--sdk-muted,#64748b)]">{t.publicUnchanged}</p>}
     <div className="flex gap-2"><Button size="sm" disabled={!!busy}>{busy===`photos:${event.id}`?t.saving:t.savePhotos}</Button><Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={()=>{morePicks.clear();setEditing(null);}}>{t.cancel}</Button></div>
    </form>:<div className="mt-2 flex flex-wrap gap-2">
     <Button type="button" size="sm" variant={event.onMap?"outline":"default"} aria-label={t.addToMapLabel(event.name)} title={event.onMap?t.zoomHint:undefined} disabled={!!busy} onClick={()=>void run(`map:${event.id}`,()=>actions.setOnMap(event.id,true))}><Plus/>{t.addToMap}</Button>
     {event.onMap&&<Button type="button" size="sm" variant="outline" aria-label={t.removeFromMapLabel(event.name)} title={t.removeFromMapHint} disabled={!!busy} onClick={()=>void run(`unmap:${event.id}`,()=>actions.setOnMap(event.id,false))}><Minus/>{t.removeFromMap}</Button>}
     <Button type="button" size="sm" variant="outline" aria-label={t.editLabel(event.name)} disabled={!!busy} onClick={()=>{setError("");setNotice("");morePicks.clear();setEditing({id:event.id,name:event.name,tags:event.tags.join(", "),photoIds:[...event.photoIds],captions:Object.fromEntries(photos.map(photo=>[photo.id,photo.caption??""]))});}}><FolderCog/>{t.edit}</Button>
     {!event.share&&<Button type="button" size="sm" variant="outline" aria-label={t.shareLabel(event.name)} disabled={!!busy} onClick={()=>void run(`share:${event.id}`,()=>share(event))}><CloudUpload/>{busy===`share:${event.id}`?t.sharing:t.share}</Button>}
     <Button type="button" size="sm" variant="ghost" aria-label={t.remove(event.name)} title={t.removeHint} disabled={!!busy} onClick={()=>void run(`remove:${event.id}`,()=>actions.remove(event.id))}><Trash2/></Button>
    </div>}
   </article>;
  })}
  {events.some(event=>!event.share)&&<p className="mt-2 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.shareNeedsDate}</p>}
 </section>;
}
