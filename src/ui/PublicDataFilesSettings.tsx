"use client";
import {publicDataFilesTh} from "./messages/publicDataFiles.js";
import {useState,type RefObject} from "react";
import {Dialog} from "radix-ui";
import {Database,RotateCcw,Search,X} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {useToolText} from "./context.js";
import {emptyPublicDataFileFilters,publicDataFileFilters,type PublicDataFileFilters} from "../core/data-file-share.js";

export function PublicDataFilesSettings({open,onOpenChange,filters,onApply,returnFocus}:{open:boolean;onOpenChange:(open:boolean)=>void;filters:PublicDataFileFilters;onApply:(filters:PublicDataFileFilters)=>void;returnFocus:RefObject<HTMLButtonElement|null>}){
 const t=useToolText("publicDataFiles",publicDataFilesTh);
 const [draft,setDraft]=useState(filters);
 const [error,setError]=useState("");
 return <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
  <Dialog.Portal><Dialog.Content onInteractOutside={event=>event.preventDefault()} onCloseAutoFocus={event=>{event.preventDefault();returnFocus.current?.focus();}} className="fixed right-3 top-20 z-50 flex max-h-[calc(100dvh-96px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)] bg-white shadow-2xl outline-none sdk-settings-panel">
   <div className="flex shrink-0 items-start justify-between border-b border-[color:var(--sdk-border,#e2e8f0)] p-4"><div><Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-[color:var(--sdk-info,#0284c7)]"/>{t.title}</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.description}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" className="size-8" aria-label={t.close}><X/></Button></Dialog.Close></div>
   <form className="space-y-4 overflow-y-auto p-4" onSubmit={event=>{
    event.preventDefault();const parsed=publicDataFileFilters.safeParse(draft);
    if(!parsed.success){setError(parsed.error.issues[0]?.message??t.invalid);return;}
    setError("");onApply(parsed.data);onOpenChange(false);
   }}>
    <div><label htmlFor="public-data-files-search" className="mb-1 block text-xs font-medium">{t.search}</label><Input id="public-data-files-search" maxLength={160} placeholder={t.searchPlaceholder} value={draft.search} onChange={event=>setDraft({...draft,search:event.target.value})}/></div>
    <div><label htmlFor="public-data-files-tag" className="mb-1 block text-xs font-medium">{t.tag}</label><Input id="public-data-files-tag" maxLength={50} placeholder={t.tagPlaceholder} value={draft.tag} onChange={event=>setDraft({...draft,tag:event.target.value})}/><p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.tagHint}</p></div>
    <p className="text-[11px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.hint}</p>
    {error&&<p role="alert" className="text-xs text-[color:var(--sdk-danger,#dc2626)]">{error}</p>}
    <div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>{setDraft(emptyPublicDataFileFilters);setError("");onApply(emptyPublicDataFileFilters);}}><RotateCcw/>{t.clear}</Button><Button className="flex-1"><Search/>{t.apply}</Button></div>
   </form>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
