"use client";
import {FileUp,Settings} from "lucide-react";
import {Button} from "../primitives/button.js";
import {Switch} from "../primitives/switch.js";
import type {DataFileServices} from "../services.js";
export function DataFilesTool({dataFilesCount,dataFilesOpen,onDataFilesSettings,dataFilesVisible,onDataFilesVisible}:DataFileServices){
 return <section className="rounded-xl border border-slate-200" aria-labelledby="data-files-tool-title"><h3 id="data-files-tool-title" className="flex items-center gap-2 border-b border-slate-100 p-3 text-sm font-semibold"><FileUp size={16}/>Simple Data Files</h3><div className="flex items-center gap-2 p-3"><label htmlFor="my-data-files-visible" className="flex-1 text-xs font-semibold">Layer My Data Files ({dataFilesCount})</label><Button id="toolbox-data-files-settings" variant="ghost" size="icon" className="size-7" aria-label="จัดการ My Data Files" aria-haspopup="dialog" aria-expanded={dataFilesOpen} onClick={event=>onDataFilesSettings(event.currentTarget)}><Settings/></Button><Switch id="my-data-files-visible" checked={dataFilesVisible} onCheckedChange={onDataFilesVisible}/></div><p className="px-3 pb-3 text-[10px] leading-5 text-slate-500">KML · GeoJSON · CSV เก็บเฉพาะเบราว์เซอร์นี้ 15 วัน</p></section>;
}
