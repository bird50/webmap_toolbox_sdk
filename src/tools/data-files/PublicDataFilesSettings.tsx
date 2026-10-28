"use client";

import {publicDataFilesTh} from "./messages/publicDataFiles.js";
import {useCallback,useEffect,useRef,useState,type RefObject} from "react";
import {Dialog} from "radix-ui";
import {Database,MapPinned,Minus,Plus,RotateCcw,Search,X} from "lucide-react";
import {Button} from "../../ui/primitives/button.js";
import {Input} from "../../ui/primitives/input.js";
import {useToolbox,useToolText} from "../../ui/context.js";
import {formatExpiry} from "../../storage/expiry.js";
import {emptyPublicSetFilters,publicSetFilters,type PublicSetFilters} from "../../contracts/share-tags.js";
import {DATA_FILE_SET_PAGE,publicDataFileSetResponse,type PublicDataFileSet} from "../../contracts/public-data-file-sets.js";

/** A Public data file set on the map, as remembered in the browser. */
export type PublicDataFileSetRef={id:string;name:string};

/**
 * Search of Public data file sets: results (newest first, 20 per page) come before anything reaches the map; each set has
 * Add to map (its own layer) and, once added, a button to take it off the map.
 */
export function PublicDataFilesSettings({open,onOpenChange,returnFocusRef,added,onAdd,onRemove}:{open:boolean;onOpenChange:(open:boolean)=>void;returnFocusRef:RefObject<HTMLButtonElement|null>;added:readonly PublicDataFileSetRef[];onAdd:(set:PublicDataFileSet)=>Promise<void>;onRemove:(id:string)=>void}) {
  const t=useToolText("publicDataFiles",publicDataFilesTh);
  const {client}=useToolbox();
  const [draft,setDraft]=useState(emptyPublicSetFilters);
  const [filters,setFilters]=useState<PublicSetFilters|null>(null);
  const [sets,setSets]=useState<PublicDataFileSet[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const controller=useRef<AbortController|null>(null);
  const search=useCallback(async(next:PublicSetFilters,offset=0)=>{
    controller.current?.abort();const active=new AbortController();controller.current=active;
    setLoading(true);setError("");
    try{
      const query=new URLSearchParams({offset:String(offset),limit:String(DATA_FILE_SET_PAGE)});
      for(const [key,value] of Object.entries(next))if(value)query.set(key,value);
      const response=await client.request("dataFileSets",{signal:active.signal,cache:"no-store"},query);
      if(!response.ok)throw new Error("search failed");
      const result=publicDataFileSetResponse.parse(await response.json());
      if(active.signal.aborted)return;
      setFilters(next);setSets(current=>offset?[...current,...result.sets]:result.sets);setHasMore(result.hasMore);
    }catch{if(!active.signal.aborted)setError(t.failed);}
    finally{if(!active.signal.aborted)setLoading(false);}
  },[client,t.failed]);
  // The newest sets are listed as soon as the dialog first opens.
  useEffect(()=>{if(open&&!filters&&!loading&&!error)void search(emptyPublicSetFilters);},[open,filters,loading,error,search]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const onMap=(id:string)=>added.some(set=>set.id===id);
  async function add(set:PublicDataFileSet){setBusy(set.id);setError("");try{await onAdd(set);}catch{setError(t.addFailed);}finally{setBusy(null);}}
  return <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <Dialog.Portal><Dialog.Content onInteractOutside={event=>event.preventDefault()} onCloseAutoFocus={event=>{event.preventDefault();returnFocusRef.current?.focus();}} className="fixed right-3 top-20 z-50 flex max-h-[calc(100dvh-96px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-[color:var(--sdk-border,#e2e8f0)] bg-white shadow-2xl outline-none sdk-settings-panel">
      <div className="flex shrink-0 items-start justify-between border-b border-[color:var(--sdk-border,#e2e8f0)] p-4"><div><Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-[color:var(--sdk-info,#0284c7)]"/>{t.title}</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.description}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" className="size-8" aria-label={t.close}><X/></Button></Dialog.Close></div>
      <div className="min-h-0 overflow-y-auto p-4">
        {added.length>0&&<section aria-labelledby="public-data-file-sets-on-map" className="mb-4 rounded-lg bg-[color:var(--sdk-info-soft,#f0f9ff)] p-3">
          <h3 id="public-data-file-sets-on-map" className="mb-1 flex items-center gap-2 text-xs font-semibold"><MapPinned className="size-4 text-[color:var(--sdk-info,#0284c7)]"/>{t.onMapTitle(added.length)}</h3>
          {added.map(set=><div key={set.id} className="flex items-center gap-2 py-0.5 text-xs"><span className="min-w-0 flex-1 truncate">{set.name}</span><Button type="button" size="icon" variant="ghost" className="size-7" aria-label={t.remove(set.name)} title={t.removeHint} onClick={()=>onRemove(set.id)}><Minus/></Button></div>)}
        </section>}
        <form className="space-y-3" onSubmit={event=>{
          event.preventDefault();const parsed=publicSetFilters.safeParse(draft);
          if(!parsed.success){setError(parsed.error.issues[0]?.message??t.invalid);return;}
          void search(parsed.data);
        }}>
          <div><label htmlFor="public-data-files-name" className="mb-1 block text-xs font-medium">{t.name}</label><Input id="public-data-files-name" maxLength={160} placeholder={t.namePlaceholder} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></div>
          <div><label htmlFor="public-data-files-username" className="mb-1 block text-xs font-medium">{t.username}</label><Input id="public-data-files-username" maxLength={100} placeholder={t.usernamePlaceholder} value={draft.username} onChange={event=>setDraft({...draft,username:event.target.value})}/></div>
          <div><label htmlFor="public-data-files-tag" className="mb-1 block text-xs font-medium">{t.tag}</label><Input id="public-data-files-tag" maxLength={50} placeholder={t.tagPlaceholder} value={draft.tag} onChange={event=>setDraft({...draft,tag:event.target.value})}/><p className="mt-1 text-[10px] text-[color:var(--sdk-muted,#64748b)]">{t.tagHint}</p></div>
          <fieldset><legend className="mb-2 text-xs font-medium">{t.shared}</legend><div className="grid grid-cols-2 gap-3"><div><label htmlFor="public-data-files-start" className="mb-1 block text-[11px] text-[color:var(--sdk-muted,#64748b)]">{t.start}</label><Input id="public-data-files-start" type="date" value={draft.startDate} max={draft.endDate||undefined} onChange={event=>setDraft({...draft,startDate:event.target.value})}/></div><div><label htmlFor="public-data-files-end" className="mb-1 block text-[11px] text-[color:var(--sdk-muted,#64748b)]">{t.end}</label><Input id="public-data-files-end" type="date" value={draft.endDate} min={draft.startDate||undefined} onChange={event=>setDraft({...draft,endDate:event.target.value})}/></div></div><p className="mt-1 text-[10px] leading-4 text-[color:var(--sdk-muted,#64748b)]">{t.dateHint}</p></fieldset>
          <p className="text-[11px] leading-5 text-[color:var(--sdk-muted,#64748b)]">{t.hint}</p>
          <div className="flex gap-2"><Button type="button" variant="outline" disabled={loading} onClick={()=>{setDraft(emptyPublicSetFilters);void search(emptyPublicSetFilters);}}><RotateCcw/>{t.clear}</Button><Button className="flex-1" disabled={loading}><Search/>{loading?t.searching:t.search}</Button></div>
        </form>
        {error&&<p role="alert" className="mt-3 text-xs text-[color:var(--sdk-danger,#dc2626)]">{error}</p>}
        <h3 className="mb-2 mt-5 text-xs font-semibold" aria-live="polite">{filters?t.results(sets.length,hasMore):t.searching}</h3>
        {filters&&!loading&&!sets.length&&!error&&<p className="text-xs text-[color:var(--sdk-muted,#64748b)]">{t.none}</p>}
        {sets.map(set=>{const shown=onMap(set.id);return <article key={set.id} aria-label={set.name} className={`mt-2 rounded-lg border p-3 ${shown?"border-[color:var(--sdk-info,#0284c7)] bg-[color:var(--sdk-info-soft,#f0f9ff)]":"border-[color:var(--sdk-border,#e2e8f0)]"}`}>
          <p className="break-words text-xs font-semibold">{set.name}{shown&&<span className="ml-2 rounded-full bg-[color:var(--sdk-info,#0284c7)] px-2 py-0.5 text-[10px] font-medium text-white">{t.onMap}</span>}</p>
          {set.description&&<p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-[color:var(--sdk-muted-strong,#475569)]">{set.description}</p>}
          {set.tags.length>0&&<p className="mt-1 flex flex-wrap gap-1">{set.tags.map(tag=><span key={tag} className="rounded-full bg-[color:var(--sdk-surface-muted,#f1f5f9)] px-2 py-0.5 text-[10px] text-[color:var(--sdk-muted-strong,#475569)]">#{tag}</span>)}</p>}
          <p className="mt-1 text-[10px] leading-4 text-[color:var(--sdk-muted,#64748b)]">{t.meta(set.username,set.featureCount,formatExpiry(set.createdAt))}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={shown?"outline":"default"} aria-label={t.addLabel(set.name)} title={shown?t.zoomHint:undefined} disabled={busy===set.id} onClick={()=>void add(set)}><Plus/>{busy===set.id?t.adding:t.add}</Button>
            {shown&&<Button type="button" size="sm" variant="outline" aria-label={t.remove(set.name)} title={t.removeHint} onClick={()=>onRemove(set.id)}><Minus/>{t.removeShort}</Button>}
          </div>
        </article>;})}
        {hasMore&&filters&&<Button type="button" variant="outline" className="mt-3 w-full" disabled={loading} onClick={()=>void search(filters,sets.length)}>{loading?t.searching:t.more}</Button>}
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
