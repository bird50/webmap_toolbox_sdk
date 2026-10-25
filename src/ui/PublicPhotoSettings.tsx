"use client";

import {useState,type RefObject} from "react";
import {Dialog} from "radix-ui";
import {Camera,RotateCcw,Search,X} from "lucide-react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {useToolMessages} from "./context.js";
import {emptyPublicPhotoFilters,publicPhotoFilters,type PublicPhotoFilters} from "../core/public-photo-query.js";

export function PublicPhotoSettings({open,onOpenChange,filters,onApply,returnFocusRef}:{open:boolean;onOpenChange:(open:boolean)=>void;filters:PublicPhotoFilters;onApply:(filters:PublicPhotoFilters)=>void;returnFocusRef:RefObject<HTMLButtonElement|null>}) {
  const t=useToolMessages().publicPhotoSettings;
  const [draft,setDraft]=useState(filters);
  const [error,setError]=useState("");
  return <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <Dialog.Portal><Dialog.Content onInteractOutside={event=>event.preventDefault()} onCloseAutoFocus={event=>{event.preventDefault();returnFocusRef.current?.focus();}} className="fixed right-3 top-20 z-50 flex max-h-[calc(100dvh-96px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)] bg-white shadow-2xl outline-none sdk-settings-panel">
      <div className="flex shrink-0 items-start justify-between border-b border-[color:var(--sdk-border,#e2e8f0)] p-4"><div><Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4 text-[color:var(--sdk-info,#0284c7)]"/>{t.title}</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.description}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" className="size-8" aria-label={t.close}><X/></Button></Dialog.Close></div>
      <form className="space-y-4 overflow-y-auto p-4" onSubmit={event=>{
        event.preventDefault();const parsed=publicPhotoFilters.safeParse(draft);
        if(!parsed.success){setError(parsed.error.issues[0]?.message??t.invalid);return;}
        setError("");onApply(parsed.data);onOpenChange(false);
      }}>
        <div><label htmlFor="public-photo-username" className="mb-1 block text-xs font-medium">{t.username}</label><Input id="public-photo-username" maxLength={100} placeholder={t.usernamePlaceholder} value={draft.username} onChange={event=>setDraft({...draft,username:event.target.value})}/></div>
        <div><label htmlFor="public-photo-event" className="mb-1 block text-xs font-medium">{t.event}</label><Input id="public-photo-event" maxLength={160} placeholder={t.eventPlaceholder} value={draft.eventName} onChange={event=>setDraft({...draft,eventName:event.target.value})}/></div>
        <fieldset><legend className="mb-2 text-xs font-medium">{t.captured}</legend><div className="grid grid-cols-2 gap-3"><div><label htmlFor="public-photo-start" className="mb-1 block text-[11px] text-[color:var(--sdk-muted,#64748b)]">{t.start}</label><Input id="public-photo-start" type="date" value={draft.startDate} max={draft.endDate||undefined} onChange={event=>setDraft({...draft,startDate:event.target.value})}/></div><div><label htmlFor="public-photo-end" className="mb-1 block text-[11px] text-[color:var(--sdk-muted,#64748b)]">{t.end}</label><Input id="public-photo-end" type="date" value={draft.endDate} min={draft.startDate||undefined} onChange={event=>setDraft({...draft,endDate:event.target.value})}/></div></div><p className="mt-2 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.dateHint}</p></fieldset>
        <div><label htmlFor="public-photo-tag" className="mb-1 block text-xs font-medium">{t.tag}</label><Input id="public-photo-tag" maxLength={50} placeholder={t.tagPlaceholder} value={draft.tag} onChange={event=>setDraft({...draft,tag:event.target.value})}/><p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.tagHint}</p></div>
        <p className="text-[11px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.hint}</p>
        {error&&<p role="alert" className="text-xs text-[color:var(--sdk-danger,#dc2626)]">{error}</p>}
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>{setDraft(emptyPublicPhotoFilters);setError("");onApply(emptyPublicPhotoFilters);}}><RotateCcw/>{t.clear}</Button><Button className="flex-1"><Search/>{t.search}</Button></div>
      </form>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
