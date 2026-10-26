"use client";
import {useId,useMemo,useState,type ReactNode} from "react";
import {bbox} from "@turf/turf";
import type {Feature} from "geojson";
import {BarChart3,ChevronLeft,ChevronRight,Search,Table2,X} from "lucide-react";
import {cellText,columnKind,matchesQuery,summarizeColumn,tableColumns,type DataSource} from "../core/data-table.js";
import {dataPanelTh,type DataPanelMessages} from "./messages/dataPanel.js";
import {useDataSources,useMapAdapter,useToolText} from "./context.js";
import {Button} from "./primitives/button.js";
import {cn} from "./utils.js";

export type DataPanelProps={
 /** Row chosen; without it the panel moves the map to the feature. */
 onSelect?:(feature:Feature,source:DataSource)=>void;
 /** Feature to highlight (compared by reference). */
 selected?:Feature|null;
 pageSize?:number;
 /** Column → header text for every source; a source's own `labels` win. */
 labels?:Readonly<Record<string,string>>;
 /** Host controls placed at the end of the toolbar, e.g. a close button. */
 actions?:ReactNode;
 className?:string;
};
const format=(value:number)=>value.toLocaleString("th-TH",{maximumFractionDigits:2});


/**
 * Data Panel: attribute table and summary chart of every data source offered with `useDataSource`
 * (visible layers only), one tab per source. Place it anywhere inside ToolboxProvider; the host sizes it.
 */
export function DataPanel({onSelect,selected,pageSize=100,labels,actions,className}:DataPanelProps){
 const t=useToolText("dataPanel",dataPanelTh);
 const sources=useDataSources(),map=useMapAdapter(),id=useId();
 const [activeId,setActiveId]=useState<string>();
 const [query,setQuery]=useState("");
 const [view,setView]=useState<"table"|"chart">("table");
 const [page,setPage]=useState(0);
 const found=sources.find(item=>item.id===activeId)??sources[0];
 // Host labels apply to every source; resolved once here so the table and chart read `source.labels` only.
 const source=useMemo(()=>found&&labels?{...found,labels:{...labels,...found.labels}}:found,[found,labels]);
 const rows=useMemo(()=>source?source.features.filter(feature=>matchesQuery(feature,query)):[],[source,query]);
 const columns=useMemo(()=>source?tableColumns(source.features,source.columns):[],[source]);
 const pages=Math.max(1,Math.ceil(rows.length/pageSize)),current=Math.min(page,pages-1);
 const choose=(next:string)=>{setActiveId(next);setPage(0);};
 function select(feature:Feature){
  if(!source)return;
  if(onSelect)return onSelect(feature,source);
  if(!map||!feature.geometry)return;
  try{
   const [west,south,east,north]=bbox(feature);
   if(west===east&&south===north)map.navigate({longitude:west,latitude:south,zoom:Math.max(map.getZoom(),12)});
   else map.fitBounds([[west,south],[east,north]]);
  }catch{/* feature without usable coordinates: keep the view */}
 }
 return <section aria-label={t.title} className={cn("toolbox-sdk flex h-full min-h-0 flex-col text-xs",className)}>
  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] px-3 py-2">
   <div role="tablist" aria-label={t.sources} className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
    {sources.map((item,index)=>{const active=item===found;return <button key={item.id} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={active} aria-controls={`${id}-view`} tabIndex={active?0:-1} onClick={()=>choose(item.id)} onKeyDown={event=>{
     const step=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:0;if(!step)return;
     const next=sources[(index+step+sources.length)%sources.length];choose(next.id);
     (event.currentTarget.parentElement?.children[(index+step+sources.length)%sources.length] as HTMLElement|undefined)?.focus();
    }} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sdk-ring,#0d9488)]",active?"bg-[color:var(--sdk-primary-soft,#f0fdfa)] text-[color:var(--sdk-primary-strong,#115e59)]":"text-[color:var(--sdk-muted,#64748b)]")}>{item.title}<span className="rounded bg-[color:var(--sdk-surface-muted,#f1f5f9)] px-1.5 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{item.features.length.toLocaleString("th-TH")}</span></button>;})}
   </div>
   {source&&<SearchBox t={t} id={`${id}-search`} value={query} onChange={value=>{setQuery(value);setPage(0);}}/>}
   {source&&<div role="group" aria-label={t.view} className="flex rounded-lg border border-[color:var(--sdk-border,#e2e8f0)] p-0.5">
    {(["table","chart"] as const).map(mode=><button key={mode} type="button" aria-pressed={view===mode} title={t[mode]} onClick={()=>setView(mode)} className={cn("flex items-center gap-1 rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sdk-ring,#0d9488)]",view===mode?"bg-[color:var(--sdk-primary-soft,#f0fdfa)] text-[color:var(--sdk-primary-strong,#115e59)]":"text-[color:var(--sdk-muted,#64748b)]")}>{mode==="table"?<Table2 size={14}/>:<BarChart3 size={14}/>}<span className="hidden sm:inline">{t[mode]}</span></button>)}
   </div>}
   {actions}
  </div>
  {source&&(source.note||source.error)&&<p role={source.error?"alert":"status"} className={cn("shrink-0 border-b border-[color:var(--sdk-border-subtle,#f1f5f9)] px-3 py-1.5 text-[11px]",source.error?"text-[color:var(--sdk-danger,#dc2626)]":"text-[color:var(--sdk-warning,#b45309)]")}>{source.error||source.note}</p>}
  <div id={`${id}-view`} role={source?"tabpanel":undefined} aria-labelledby={found?`${id}-tab-${sources.indexOf(found)}`:undefined} aria-busy={source?.loading||undefined} className="min-h-0 flex-1 overflow-auto">
   {!source?<Notice>{t.noSources}</Notice>
    :source.loading&&!source.features.length?<Notice>{t.loading}</Notice>
    :!source.features.length?<Notice>{t.empty}</Notice>
    :!rows.length?<Notice>{t.noMatch}</Notice>
    :view==="table"?<DataTable source={source} columns={columns} rows={rows.slice(current*pageSize,(current+1)*pageSize)} selected={selected} onSelect={select} t={t}/>
    :<DataChart key={source.id} source={source} columns={columns} rows={rows} filtered={rows.length!==source.features.length} t={t}/>}
  </div>
  {source&&view==="table"&&rows.length>0&&<div className="flex shrink-0 items-center justify-between gap-2 border-t border-[color:var(--sdk-border-subtle,#f1f5f9)] px-3 py-1.5 text-[11px] text-[color:var(--sdk-muted,#64748b)]">
   <span aria-live="polite">{t.count(rows.length)}</span>
   {pages>1&&<span className="flex items-center gap-1"><Button variant="ghost" size="icon" className="size-7" aria-label={t.previous} disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft/></Button>{t.page(current+1,pages)}<Button variant="ghost" size="icon" className="size-7" aria-label={t.next} disabled={current>=pages-1} onClick={()=>setPage(current+1)}><ChevronRight/></Button></span>}
  </div>}
 </section>;
}
const headerText=(source:DataSource,column:string)=>source.labels?.[column]??column;
function Notice({children}:{children:ReactNode}){return <p role="status" className="p-6 text-center text-[color:var(--sdk-muted,#64748b)]">{children}</p>;}
function SearchBox({t,id,value,onChange}:{t:DataPanelMessages;id:string;value:string;onChange:(value:string)=>void}){
 return <div className="relative w-full sm:w-48"><label htmlFor={id} className="sr-only">{t.search}</label><Search size={14} className="pointer-events-none absolute left-2.5 top-2 text-[color:var(--sdk-muted,#64748b)]"/>
  <input id={id} type="search" value={value} placeholder={t.searchPlaceholder} onChange={event=>onChange(event.target.value)} className="h-8 w-full rounded-lg border border-[color:var(--sdk-border,#e2e8f0)] bg-transparent pl-8 pr-7 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sdk-ring,#0d9488)]"/>
  {value&&<button type="button" aria-label={t.clearSearch} onClick={()=>onChange("")} className="absolute right-1.5 top-1.5 rounded p-0.5 text-[color:var(--sdk-muted,#64748b)] focus-visible:ring-2"><X size={14}/></button>}</div>;
}
function DataTable({source,columns,rows,selected,onSelect,t}:{source:DataSource;columns:readonly string[];rows:readonly Feature[];selected?:Feature|null;onSelect:(feature:Feature)=>void;t:DataPanelMessages}){
 const [first,...rest]=columns;
 return <table className="w-full min-w-[520px] text-left">
  <thead className="sticky top-0 bg-[color:var(--sdk-surface-subtle,#f8fafc)] text-[10px] text-[color:var(--sdk-muted,#64748b)]"><tr>{columns.map(column=><th key={column} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{headerText(source,column)}</th>)}</tr></thead>
  <tbody>{rows.map((feature,index)=>{const label=cellText(feature.properties?.[first])||String(index+1);return <tr key={feature.id??index} aria-selected={feature===selected} className={cn("border-t border-[color:var(--sdk-border-subtle,#f1f5f9)]",feature===selected&&"bg-[color:var(--sdk-primary-soft,#f0fdfa)]")}>
   <td className="px-3 py-1.5"><button type="button" aria-label={t.locate(label)} onClick={()=>onSelect(feature)} className="text-left font-medium text-[color:var(--sdk-primary,#0f766e)] underline-offset-2 outline-none hover:underline focus-visible:underline">{label}</button></td>
   {rest.map(column=><td key={column} className="max-w-64 truncate px-3 py-1.5" title={cellText(feature.properties?.[column])}>{cellText(feature.properties?.[column])}</td>)}
  </tr>;})}</tbody>
 </table>;
}
function DataChart({source,columns,rows,filtered,t}:{source:DataSource;columns:readonly string[];rows:readonly Feature[];filtered:boolean;t:DataPanelMessages}){
 // Prefer a numeric column: a histogram usually says more than counts of names.
 const [column,setColumn]=useState(()=>columns.find(item=>columnKind(source.features,item)==="number")??columns[0]);
 const selectId=useId();
 const summary=useMemo(()=>column?summarizeColumn(rows,column):undefined,[rows,column]);
 if(!column||!summary)return <Notice>{t.noColumns}</Notice>;
 const bars=summary.kind==="number"?summary.bins.map(bin=>({label:`${format(bin.from)} – ${format(bin.to)}`,count:bin.count})):[...summary.bins,...(summary.other?[{label:t.other,count:summary.other}]:[])];
 const peak=Math.max(1,...bars.map(bar=>bar.count)),title=headerText(source,column);
 return <div className="p-3">
  <div className="mb-3 flex flex-wrap items-center gap-2"><label htmlFor={selectId} className="text-[color:var(--sdk-muted,#64748b)]">{t.column}</label>
   <select id={selectId} value={column} onChange={event=>setColumn(event.target.value)} className="h-8 rounded-lg border border-[color:var(--sdk-border,#e2e8f0)] bg-transparent px-2 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sdk-ring,#0d9488)]">{columns.map(item=><option key={item} value={item}>{headerText(source,item)}</option>)}</select>
   <span className="text-[11px] text-[color:var(--sdk-muted,#64748b)]">{summary.kind==="number"?t.numberSummary(summary.count,format(summary.min),format(summary.mean),format(summary.max)):t.categorySummary(summary.count,summary.distinct)}{filtered&&` · ${t.filtered}`}</span>
  </div>
  <figure aria-label={t.chartLabel(title)} className="m-0">
   <ul className="m-0 grid list-none gap-1 p-0">{bars.map(bar=><li key={bar.label} className="grid grid-cols-[minmax(6rem,12rem)_1fr_3rem] items-center gap-2">
    <span className="truncate text-[11px] text-[color:var(--sdk-text-secondary,#334155)]" title={bar.label}>{bar.label||"—"}</span>
    <span className="h-3 rounded-sm bg-[color:var(--sdk-surface-muted,#f1f5f9)]"><span className="block h-full rounded-sm bg-[color:var(--sdk-primary,#0f766e)]" style={{width:`${bar.count/peak*100}%`}}/></span>
    <span className="text-right font-mono text-[11px]">{bar.count.toLocaleString("th-TH")}</span>
   </li>)}</ul>
  </figure>
 </div>;
}
