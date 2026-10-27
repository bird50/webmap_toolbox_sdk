"use client";
import {dataFilesToolTh} from "../messages/dataFilesTool.js";
import {FileUp,Settings} from "lucide-react";
import {Button} from "../primitives/button.js";
import {useToolText} from "../context.js";
/** `onPublic` is optional: without it the panel shows My Data Files only. */
export type DataFilesToolProps={setCount:number;setsOnMap:number;onSets:(trigger:HTMLButtonElement)=>void;setsOpen:boolean;publicSetsOnMap?:number;onPublic?:(trigger:HTMLButtonElement)=>void;publicOpen?:boolean};
/** Data Files section of the Toolbox: My Data Files sets and the Public Data Files search (settings buttons only). */
export function DataFilesTool({setCount,setsOnMap,onSets,setsOpen,publicSetsOnMap=0,onPublic,publicOpen=false}:DataFilesToolProps){
 const t=useToolText("dataFilesTool",dataFilesToolTh);
 return <section aria-labelledby="data-files-tool-title" className="overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)]">
  <h3 id="data-files-tool-title" className="flex items-center gap-2 border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3 text-sm font-semibold"><FileUp className="size-4 text-[color:var(--sdk-primary,#0f766e)]"/>{t.title}</h3>
  <div className={onPublic?"border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] p-3":"p-3"}><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{t.mine} <span className="font-normal text-[color:var(--sdk-muted,#64748b)]">{t.mineCount(setsOnMap,setCount)}</span></p><Button id="toolbox-data-files-settings" variant="ghost" size="icon" className="size-7 shrink-0" title={t.mineManage} aria-label={t.settings} aria-haspopup="dialog" aria-expanded={setsOpen} onClick={event=>onSets(event.currentTarget)}><Settings/></Button></div><p className="mt-1 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.mineHint}</p></div>
  {onPublic&&<div className="p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{t.public} <span className="font-normal text-[color:var(--sdk-muted,#64748b)]">{t.publicCount(publicSetsOnMap)}</span></p><Button id="toolbox-public-data-files-settings" variant="ghost" size="icon" className="size-7 shrink-0 text-[color:var(--sdk-info,#0284c7)]" title={t.publicSearch} aria-label={t.publicSettings} aria-haspopup="dialog" aria-expanded={publicOpen} onClick={event=>onPublic(event.currentTarget)}><Settings/></Button></div><p className="mt-1 text-[10px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.publicHint}</p></div>}
 </section>;
}
