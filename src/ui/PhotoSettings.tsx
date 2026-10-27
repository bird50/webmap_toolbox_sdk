"use client";

import {photoSettingsTh} from "./messages/photoSettings.js";
import {useState} from "react";
import {Dialog} from "radix-ui";
import {X,Settings} from "lucide-react";
import {Button} from "./primitives/button.js";
import type {GeotaggedPhoto} from "../core/photo-gps.js";
import {formatPhotoExpiry,type PhotoEvent,type StoredPhoto} from "../storage/photo-storage.js";
import {PublicPhotoShare} from "./PublicPhotoShare.js";
import {PhotoEvents} from "./PhotoEvents.js";
import {PhotoPicker,usePhotoPicks} from "./PhotoPicker.js";
import type {PhotoEventActions} from "./plugins/photo.js";
import {useToolText} from "./context.js";

type AddPhotos=(photos:(GeotaggedPhoto&{caption?:string})[])=>Promise<StoredPhoto[]>;

/** 1.x flow: Add to My Photos first, then share selected photos directly. */
function AddToMyPhotos({onAdd,storageReady,savedPhotos}:{onAdd:AddPhotos;storageReady:boolean;savedPhotos:StoredPhoto[]}){
  const t=useToolText("photoSettings",photoSettingsTh);
  const picks=usePhotoPicks();
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  return <>
    <PhotoPicker picks={picks} id="toolbox-photo" disabled={saving}/>
    <p className="mt-2 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.savedOnAdd}</p>
    {error&&<p role="alert" className="mt-2 text-xs text-[color:var(--sdk-danger,#dc2626)]">{error}</p>}
    <Button className="mt-3 w-full" disabled={picks.reading||saving||!storageReady||!picks.ready} onClick={async()=>{
      setSaving(true);setError("");setNotice("");
      try{const stored=await onAdd(picks.photos());setNotice(t.saved(stored.length,formatPhotoExpiry(stored[0].expiresAt)));picks.clear();}
      catch{setError(t.saveFailed);}
      finally{setSaving(false);}
    }}>{saving?t.saving:t.add}</Button>
    {notice&&<p role="status" className="mt-2 text-xs text-[color:var(--sdk-primary,#0f766e)]">{notice}</p>}
    <PublicPhotoShare photos={savedPhotos}/>
  </>;
}

/**
 * With `events` and `eventActions` photos are chosen straight into an event set (save, add to map, share); without them
 * the dialog keeps the 1.x flow (Add to My Photos, then share selected photos).
 */
export function PhotoSettings({open,onOpenChange,onAdd,storageReady,storageMessage,savedPhotos,events,eventActions}:{open:boolean;onOpenChange:(open:boolean)=>void;onAdd:AddPhotos;storageReady:boolean;storageMessage:string;savedPhotos:StoredPhoto[];events?:PhotoEvent[];eventActions?:PhotoEventActions}) {
  const t=useToolText("photoSettings",photoSettingsTh);
  const sets=!!events&&!!eventActions;
  return <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <Dialog.Portal>
      <Dialog.Content onInteractOutside={event=>event.preventDefault()} onCloseAutoFocus={event=>{event.preventDefault();document.getElementById("toolbox-my-photos-settings")?.focus();}} className="fixed right-3 top-20 z-50 flex max-h-[calc(100dvh-96px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)] bg-white shadow-2xl outline-none data-[state=closed]:hidden sdk-settings-panel">
        <div className="flex shrink-0 items-start justify-between border-b border-[color:var(--sdk-border,#e2e8f0)] p-4">
          <div><Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><Settings className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</Dialog.Title><Dialog.Description className="mt-1 text-xs text-[color:var(--sdk-muted,#64748b)]">{t.description}</Dialog.Description></div>
          <Dialog.Close asChild><Button variant="ghost" size="icon" className="size-8" aria-label={t.close}><X/></Button></Dialog.Close>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <p className="mb-3 rounded-lg bg-[color:var(--sdk-primary-soft,#f0fdfa)] p-3 text-xs leading-5 text-[color:var(--sdk-primary-strong,#115e59)]">{sets?t.introSets:t.intro}</p>
          {storageMessage&&<p role="status" className="mb-3 text-xs text-[color:var(--sdk-warning,#b45309)]">{storageMessage}</p>}
          {!storageReady&&!storageMessage&&<p role="status" className="mb-3 text-xs text-[color:var(--sdk-muted,#64748b)]">{t.opening}</p>}
          {sets?<PhotoEvents photos={savedPhotos} events={events} actions={eventActions} onAdd={onAdd} storageReady={storageReady}/>:<AddToMyPhotos onAdd={onAdd} storageReady={storageReady} savedPhotos={savedPhotos}/>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
