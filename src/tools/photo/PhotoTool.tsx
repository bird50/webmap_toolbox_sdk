"use client";
import {photoToolTh} from "./messages/photoTool.js";
import {Camera,Settings} from "lucide-react";
import {Button} from "../../ui/primitives/button.js";
import {useToolText} from "../../ui/context.js";
export type PhotoToolProps={onMyPhotoSettings:()=>void;myPhotoSettingsOpen:boolean;count:number;eventsOnMap:number;publicSetsOnMap:number;onPublicSettings:(trigger:HTMLButtonElement)=>void;publicSettingsOpen:boolean};
export function PhotoTool({onMyPhotoSettings,myPhotoSettingsOpen,count,eventsOnMap,publicSetsOnMap,onPublicSettings,publicSettingsOpen}:PhotoToolProps){
const t=useToolText("photoTool",photoToolTh);
return <section aria-labelledby="photo-tool-title" className="overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)]">
        <h3 id="photo-tool-title" className="flex items-center gap-2 border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3 text-sm font-semibold"><Camera className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</h3>
        <div className="flex items-center justify-between gap-2 p-3"><p className="text-xs font-semibold">{t.myLayer} <span className="font-normal text-[color:var(--sdk-muted,#64748b)]">{t.myCount(eventsOnMap,count)}</span></p><Button id="toolbox-my-photos-settings" variant="ghost" size="icon" className="size-7 shrink-0" title={t.myManage} aria-label={t.mySettings} aria-haspopup="dialog" aria-expanded={myPhotoSettingsOpen} onClick={onMyPhotoSettings}><Settings/></Button></div>
        <p className="px-3 pb-3 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.myHint}</p>
        <div className="border-t border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{t.publicLayer} <span className="font-normal text-[color:var(--sdk-muted,#64748b)]">{t.publicCount(publicSetsOnMap)}</span></p><Button id="toolbox-public-photos-settings" variant="ghost" size="icon" className="size-7 shrink-0 text-[color:var(--sdk-info,#0284c7)]" title={t.publicSearch} aria-label={t.publicSettings} aria-haspopup="dialog" aria-expanded={publicSettingsOpen} onClick={event=>onPublicSettings(event.currentTarget)}><Settings/></Button></div><p className="mt-2 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.publicHint}</p></div>
      </section>;
}
