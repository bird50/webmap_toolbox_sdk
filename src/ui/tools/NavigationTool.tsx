"use client";
import type {WebmapHost} from "../contracts.js";

/** Portable example: no MapLibre, app state, or workspace service dependency. */
export function NavigationTool({host}:{host:WebmapHost}) {
  return <section aria-label="เครื่องมือมุมมอง" className="rounded-xl border border-slate-200 p-3"><h3 className="mb-3 text-sm font-semibold">มุมมองแผนที่</h3><button type="button" className="rounded-md border px-3 py-2 text-xs focus-visible:outline-teal-600" onClick={()=>host.navigate({longitude:100.5,latitude:13.5,zoom:5})}>แสดงประเทศไทย</button><p className="mt-2 text-[11px] text-slate-500">เปิดอยู่ {host.layers.filter(layer=>host.visible[layer.id]&&layer.url).length} ชั้นข้อมูล</p></section>;
}
