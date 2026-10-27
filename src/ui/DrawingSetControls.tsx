"use client";
import {drawingSetControlsTh} from "./messages/drawingSetControls.js";
import {useToolText} from "./context.js";
import {useState} from "react";
import {FolderPlus,Save,X} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {shareTags} from "../core/share-tags.js";
import type {DrawingEdit} from "./DrawingWorkspace.js";

/** Bottom of the Drawing Toolbar: save the draft as a named set, or save/cancel the edit of an existing set. */
export function DrawingSetControls({editing,count,ready,storageMessage,onSave,onSaveEdit,onCancelEdit}:{editing:DrawingEdit|null;count:number;ready:boolean;storageMessage:string;onSave:(input:{name:string;tags:string[]})=>Promise<void>;onSaveEdit:()=>Promise<void>;onCancelEdit:()=>void}){
 const t=useToolText("drawingSetControls",drawingSetControlsTh);
 const [name,setName]=useState(""),[tags,setTags]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(false);
 async function run(work:()=>Promise<void>,done:string){setBusy(true);setError(false);setMessage("");try{await work();setMessage(done);}catch(failure){setError(true);setMessage(failure instanceof Error&&failure.message?failure.message:t.failed);}finally{setBusy(false);}}
 return <section className="space-y-2 border-t pt-3" aria-label={t.section}>
  <p role="status" className="text-[11px] leading-4 text-[color:var(--sdk-muted-strong,#475569)]">{storageMessage}</p>
  {editing?<div className="flex gap-2">
   <Button size="sm" className="flex-1" disabled={!ready||busy||!count} onClick={()=>void run(onSaveEdit,t.edited(editing.name))}><Save/>{busy?t.busy:t.saveEdit}</Button>
   <Button size="sm" variant="ghost" disabled={busy} onClick={onCancelEdit}><X/>{t.cancel}</Button>
  </div>:<form noValidate className="space-y-2" onSubmit={event=>{
   event.preventDefault();
   if(!name.trim()){setError(true);setMessage(t.nameRequired);return;}
   const parsed=shareTags.safeParse(tags.split(",").map(tag=>tag.trim()).filter(Boolean));
   if(!parsed.success){setError(true);setMessage(t.invalidTags);return;}
   if(!count){setError(true);setMessage(t.empty);return;}
   const title=name.trim();
   void run(async()=>{await onSave({name:title,tags:parsed.data});setName("");setTags("");},t.saved(title));
  }}>
   <label htmlFor="drawing-set-name" className="block text-[11px] font-medium">{t.name}<span aria-hidden="true" className="ml-0.5 text-[color:var(--sdk-danger,#dc2626)]">*</span></label>
   <Input id="drawing-set-name" value={name} maxLength={160} required aria-required="true" disabled={busy} placeholder={t.namePlaceholder} onChange={event=>setName(event.target.value)}/>
   <label htmlFor="drawing-set-tags" className="block text-[11px] font-medium">{t.tags}</label>
   <Input id="drawing-set-tags" value={tags} maxLength={510} disabled={busy} placeholder={t.tagsPlaceholder} onChange={event=>setTags(event.target.value)}/>
   <Button size="sm" className="w-full" disabled={!ready||busy||!count}><FolderPlus/>{busy?t.busy:t.save}</Button>
  </form>}
  {message&&<p role={error?"alert":"status"} className={`text-[11px] ${error?"text-[color:var(--sdk-danger,#dc2626)]":"text-[color:var(--sdk-primary,#0f766e)]"}`}>{message}</p>}
 </section>;
}
