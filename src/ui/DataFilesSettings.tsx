"use client";
import {dataFilesSettingsTh} from "./messages/dataFilesSettings.js";
import {useState,type RefObject} from "react";
import {Dialog} from "radix-ui";
import {CloudUpload,FileUp,FolderCog,Minus,Plus,Settings,Trash2,X} from "lucide-react";
import type {FeatureCollection} from "geojson";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {useToolbox,useToolText} from "./context.js";
import {parseDataFile} from "../core/data-files.js";
import {dataFileShareFields,dataFileShareSchema,MAX_DATA_SHARE_BYTES} from "../core/data-file-share.js";
import {formatExpiry} from "../storage/expiry.js";
import type {StoredDataFile} from "../storage/data-file-storage.js";
import type {DataFileSetActions} from "./plugins/data-files.js";

const splitTags=(value:string)=>value.split(",").map(tag=>tag.trim()).filter(Boolean);
const fieldClass="w-full rounded-lg border border-[color:var(--sdk-border,#e2e8f0)] p-2 text-xs";
type Draft={name:string;description:string;tags:string};

/**
 * My Data Files: a file is chosen into a new named set (name required, description and tags optional). Each set can be
 * added to or removed from the map, managed (name, description, tags, its data replaced by a new file), saved to Public
 * once, or deleted.
 */
export function DataFilesSettings({open,onOpenChange,returnFocusRef,files,ready,error:storeError,actions}:{open:boolean;onOpenChange:(open:boolean)=>void;returnFocusRef:RefObject<HTMLButtonElement|null>;files:readonly StoredDataFile[];ready:boolean;error:string;actions:DataFileSetActions}){
 const t=useToolText("dataFilesSettings",dataFilesSettingsTh);
 const {client}=useToolbox();
 const [file,setFile]=useState<File|null>(null),[inputKey,setInputKey]=useState(0);
 const [draft,setDraft]=useState<Draft>({name:"",description:"",tags:""});
 const [editing,setEditing]=useState<Draft&{id:string;file:File|null}|null>(null);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 async function run(key:string,work:()=>Promise<void>){
  setBusy(key);setError("");setNotice("");
  try{await work();}catch(failure){setError(failure instanceof Error&&failure.message?failure.message:t.actionFailed);}finally{setBusy(null);}
 }
 /** Name, description and tags checked as Save to Public will check them, so a set never holds fields it could not share. */
 function fields(value:Draft){
  if(!value.name.trim())throw new Error(t.nameRequired);
  const parsed=dataFileShareFields.safeParse({name:value.name,description:value.description,tags:splitTags(value.tags)});
  if(!parsed.success)throw new Error(t.invalidFields);
  return parsed.data;
 }
 async function share(set:StoredDataFile){
  const parsed=dataFileShareSchema.safeParse({name:set.name,description:set.description,tags:set.tags,data:set.data});
  if(!parsed.success)throw new Error(t.invalidShare);
  const body=JSON.stringify(parsed.data);
  if(new TextEncoder().encode(body).length>MAX_DATA_SHARE_BYTES)throw new Error(t.tooLarge);
  const response=await client.request("dataFileShares",{method:"POST",headers:{"content-type":"application/json"},body});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||t.shareFailed);
  await actions.recordShare(set.id,{id:result.id,tags:result.tags??[],sharedAt:Date.now()});
  client.notify("dataFiles");
  setNotice(t.shared(set.name));
 }
 return <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
  <Dialog.Portal><Dialog.Content onInteractOutside={event=>event.preventDefault()} onCloseAutoFocus={event=>{event.preventDefault();returnFocusRef.current?.focus();}} className="fixed right-3 top-20 z-50 flex max-h-[calc(100dvh-96px)] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)] bg-white shadow-2xl outline-none sdk-settings-panel">
   <div className="flex shrink-0 items-start justify-between border-b border-[color:var(--sdk-border,#e2e8f0)] p-4"><div><Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><Settings className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.description}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" className="size-8" aria-label={t.close}><X/></Button></Dialog.Close></div>
   <div className="min-h-0 overflow-y-auto p-4">
    <p className="mb-3 rounded-lg bg-[color:var(--sdk-primary-soft,#f0fdfa)] p-3 text-xs leading-5 text-[color:var(--sdk-primary-strong,#115e59)]">{t.storageNote}</p>
    <form noValidate aria-label={t.newSet} className="space-y-2 rounded-lg border border-[color:var(--sdk-border,#e2e8f0)] p-3" onSubmit={event=>{
     event.preventDefault();
     void run("add",async()=>{
      if(!file)throw new Error(t.fileRequired);
      const details=fields(draft);
      let data:FeatureCollection;
      try{data=await parseDataFile(file);}catch(failure){throw failure instanceof Error?failure:new Error(t.importFailed);}
      await actions.add({...details,data});
      setFile(null);setInputKey(key=>key+1);setDraft({name:"",description:"",tags:""});setNotice(t.added(details.name));
     });
    }}>
     <h3 className="flex items-center gap-2 text-xs font-semibold"><FileUp className="size-4"/>{t.newSet}</h3>
     <div><label htmlFor="data-file-input" className="mb-1 block text-xs font-medium">{t.chooseFile}<span aria-hidden="true" className="ml-0.5 text-[color:var(--sdk-danger,#dc2626)]">*</span></label><Input key={inputKey} id="data-file-input" type="file" accept=".kml,.geojson,.json,.csv" disabled={!!busy||!ready} className="h-auto text-xs" onChange={event=>{
      const chosen=event.target.files?.[0]??null;setFile(chosen);setError("");setNotice("");
      // The set is named after the file until the user types a name.
      if(chosen)setDraft(current=>current.name?current:{...current,name:chosen.name.replace(/\.[^.]+$/,"")});
     }}/><p className="mt-1 text-[10px] leading-4 text-[color:var(--sdk-muted,#64748b)]">{t.limits}<br/>{t.csvHint}<br/>{t.totalLimits}</p></div>
     <div><label htmlFor="data-file-name" className="mb-1 block text-xs font-medium">{t.name}<span aria-hidden="true" className="ml-0.5 text-[color:var(--sdk-danger,#dc2626)]">*</span></label><Input id="data-file-name" required aria-required="true" maxLength={160} value={draft.name} disabled={!!busy} placeholder={t.namePlaceholder} onChange={event=>setDraft({...draft,name:event.target.value})}/></div>
     <div><label htmlFor="data-file-description" className="mb-1 block text-xs font-medium">{t.fileDescription}</label><textarea id="data-file-description" maxLength={1000} rows={2} value={draft.description} disabled={!!busy} placeholder={t.descriptionPlaceholder} onChange={event=>setDraft({...draft,description:event.target.value})} className={fieldClass}/></div>
     <div><label htmlFor="data-file-tags" className="mb-1 block text-xs font-medium">{t.tags}</label><Input id="data-file-tags" maxLength={510} value={draft.tags} disabled={!!busy} placeholder={t.tagsPlaceholder} onChange={event=>setDraft({...draft,tags:event.target.value})}/></div>
     <Button type="submit" size="sm" className="w-full" disabled={!!busy||!ready}>{busy==="add"?t.importing:t.add}</Button>
    </form>
    {!ready&&!storeError&&<p role="status" className="mt-2 text-xs text-[color:var(--sdk-muted,#64748b)]">{t.opening}</p>}
    {(error||storeError)&&<p role="alert" className="mt-2 text-xs text-[color:var(--sdk-danger,#dc2626)]">{error||storeError}</p>}
    {storeError&&<Button variant="outline" size="sm" className="mt-2" disabled={!!busy} onClick={()=>void run("retry",actions.retry)}>{t.retry}</Button>}
    {notice&&<p role="status" className="mt-2 text-xs text-[color:var(--sdk-primary,#0f766e)]">{notice}</p>}
    <h3 className="mb-2 mt-5 text-xs font-semibold">{t.files(files.length)}</h3>
    {ready&&!files.length&&<p className="text-xs text-[color:var(--sdk-muted,#64748b)]">{t.empty}</p>}
    {files.map(set=><article key={set.id} aria-label={set.name} className={`mt-2 rounded-lg border p-3 ${set.onMap?"border-[color:var(--sdk-primary,#0f766e)] bg-[color:var(--sdk-primary-soft,#f0fdfa)]":"border-[color:var(--sdk-border,#e2e8f0)]"}`}>
     <p className="break-words text-xs font-semibold">{set.name}{set.onMap&&<span className="ml-2 rounded-full bg-[color:var(--sdk-primary,#0f766e)] px-2 py-0.5 text-[10px] font-medium text-white">{t.onMap}</span>}</p>
     {set.description&&<p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-[color:var(--sdk-muted-strong,#475569)]">{set.description}</p>}
     {set.tags.length>0&&<p className="mt-1 flex flex-wrap gap-1">{set.tags.map(tag=><span key={tag} className="rounded-full bg-[color:var(--sdk-surface-muted,#f1f5f9)] px-2 py-0.5 text-[10px] text-[color:var(--sdk-muted-strong,#475569)]">{tag}</span>)}</p>}
     <p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.meta(set.data.features.length,formatExpiry(set.expiresAt))}</p>
     {set.share&&<p role="status" className="mt-1 text-[11px] leading-5 text-[color:var(--sdk-primary-strong,#115e59)]">{t.sharedStatus(set.share.tags.join(", "))}</p>}
     {editing?.id===set.id?<form noValidate className="mt-2 space-y-2" aria-label={t.manageLabel(set.name)} onSubmit={event=>{
      event.preventDefault();
      void run(`details:${set.id}`,async()=>{
       const details=fields(editing);
       const data=editing.file?await parseDataFile(editing.file):undefined;
       await actions.setDetails(set.id,{...details,...(data?{data}:{})});
       setEditing(null);setNotice(t.saved(details.name));
      });
     }}>
      <div><label htmlFor={`data-file-name-${set.id}`} className="mb-1 block text-xs font-medium">{t.name}<span aria-hidden="true" className="ml-0.5 text-[color:var(--sdk-danger,#dc2626)]">*</span></label><Input id={`data-file-name-${set.id}`} required aria-required="true" maxLength={160} value={editing.name} disabled={!!busy} onChange={change=>{const value=change.target.value;setEditing(current=>current&&{...current,name:value});}}/></div>
      <div><label htmlFor={`data-file-description-${set.id}`} className="mb-1 block text-xs font-medium">{t.fileDescription}</label><textarea id={`data-file-description-${set.id}`} maxLength={1000} rows={2} value={editing.description} disabled={!!busy} onChange={change=>{const value=change.target.value;setEditing(current=>current&&{...current,description:value});}} className={fieldClass}/></div>
      <div><label htmlFor={`data-file-tags-${set.id}`} className="mb-1 block text-xs font-medium">{t.tags}</label><Input id={`data-file-tags-${set.id}`} maxLength={510} value={editing.tags} disabled={!!busy} placeholder={t.tagsPlaceholder} onChange={change=>{const value=change.target.value;setEditing(current=>current&&{...current,tags:value});}}/></div>
      <div><label htmlFor={`data-file-replace-${set.id}`} className="mb-1 block text-xs font-medium">{t.replaceFile}</label><Input id={`data-file-replace-${set.id}`} type="file" accept=".kml,.geojson,.json,.csv" disabled={!!busy} className="h-auto text-xs" onChange={change=>{const chosen=change.target.files?.[0]??null;setEditing(current=>current&&{...current,file:chosen});}}/></div>
      {set.share&&<p className="text-[10px] leading-4 text-[color:var(--sdk-muted,#64748b)]">{t.publicUnchanged}</p>}
      <div className="flex gap-2"><Button size="sm" disabled={!!busy}>{busy===`details:${set.id}`?t.saving:t.save}</Button><Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={()=>setEditing(null)}>{t.cancel}</Button></div>
     </form>:<div className="mt-2 flex flex-wrap gap-2">
      <Button type="button" size="sm" variant={set.onMap?"outline":"default"} aria-label={t.addToMapLabel(set.name)} title={set.onMap?t.zoomHint:undefined} disabled={!!busy} onClick={()=>void run(`map:${set.id}`,()=>actions.setOnMap(set.id,true))}><Plus/>{t.addToMap}</Button>
      {set.onMap&&<Button type="button" size="sm" variant="outline" aria-label={t.removeFromMapLabel(set.name)} title={t.removeFromMapHint} disabled={!!busy} onClick={()=>void run(`unmap:${set.id}`,()=>actions.setOnMap(set.id,false))}><Minus/>{t.removeFromMap}</Button>}
      <Button type="button" size="sm" variant="outline" aria-label={t.manageLabel(set.name)} disabled={!!busy} onClick={()=>{setError("");setNotice("");setEditing({id:set.id,name:set.name,description:set.description,tags:set.tags.join(", "),file:null});}}><FolderCog/>{t.manage}</Button>
      {!set.share&&<Button type="button" size="sm" variant="outline" aria-label={t.shareLabel(set.name)} disabled={!!busy} onClick={()=>void run(`share:${set.id}`,()=>share(set))}><CloudUpload/>{busy===`share:${set.id}`?t.sharing:t.share}</Button>}
      <Button type="button" size="sm" variant="ghost" aria-label={t.remove(set.name)} title={t.removeHint} disabled={!!busy} onClick={()=>void run(`remove:${set.id}`,()=>actions.remove(set.id))}><Trash2/></Button>
     </div>}
    </article>)}
    {files.some(set=>!set.share)&&<p className="mt-2 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.shareNotice}</p>}
   </div>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
