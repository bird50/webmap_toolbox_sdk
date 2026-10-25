"use client";
import {FileUp,Settings} from "lucide-react";
import {Button} from "../primitives/button.js";
import {Switch} from "../primitives/switch.js";
import {useToolMessages} from "../context.js";
export type DataFilesToolProps={dataFilesCount:number;dataFilesOpen:boolean;onDataFilesSettings:(trigger:HTMLButtonElement)=>void;dataFilesVisible:boolean;onDataFilesVisible:(visible:boolean)=>void};
export function DataFilesTool({dataFilesCount,dataFilesOpen,onDataFilesSettings,dataFilesVisible,onDataFilesVisible}:DataFilesToolProps){
 const t=useToolMessages().dataFilesTool;
 return <section className="rounded-xl border border-[color:var(--sdk-border,#e2e8f0)]" aria-labelledby="data-files-tool-title"><h3 id="data-files-tool-title" className="flex items-center gap-2 border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3 text-sm font-semibold"><FileUp size={16}/>{t.title}</h3><div className="flex items-center gap-2 p-3"><label htmlFor="my-data-files-visible" className="flex-1 text-xs font-semibold">{t.layer(dataFilesCount)}</label><Button id="toolbox-data-files-settings" variant="ghost" size="icon" className="size-7" aria-label={t.settings} aria-haspopup="dialog" aria-expanded={dataFilesOpen} onClick={event=>onDataFilesSettings(event.currentTarget)}><Settings/></Button><Switch id="my-data-files-visible" checked={dataFilesVisible} onCheckedChange={onDataFilesVisible}/></div><p className="px-3 pb-3 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.note}</p></section>;
}
