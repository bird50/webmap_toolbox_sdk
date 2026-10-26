"use client";
import {drawingShareTh} from "./messages/drawingShare.js";
import {useToolbox,useToolText} from "./context.js";
import {useState} from "react";
import {Button} from "./primitives/button.js";
import {Input} from "./primitives/input.js";
import {drawingShareSchema} from "../core/drawing-contract.js";
import type {Drawing} from "../core/drawing.js";
export function DrawingShareControls({drawings,selected,ready,onSave,storageMessage}:{drawings:Drawing[];selected?:Drawing;ready:boolean;onSave:()=>Promise<void>;storageMessage:string}){
 const {client}=useToolbox();const t=useToolText("drawingShare",drawingShareTh);
 const [name,setName]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState(false);
 return <section className="space-y-2 border-t pt-3" aria-label={t.section}>
 <Button size="sm" className="w-full" disabled={!ready||busy} onClick={async()=>{setBusy(true);try{await onSave();}finally{setBusy(false);}}}>{t.save}</Button>
 <p role="status" className="text-[11px] text-[color:var(--sdk-muted-strong,#475569)]">{storageMessage}</p>
 <form className="space-y-2" onSubmit={async event=>{
 event.preventDefault();setError(false);setMessage("");
 const parsed=drawingShareSchema.safeParse({name,drawings:selected?[selected]:drawings});
 if(!parsed.success){setError(true);setMessage(t.invalid);return;}
 const body=JSON.stringify(parsed.data);if(new Blob([body]).size>1024*1024){setError(true);setMessage(t.tooLarge);return;}
 setBusy(true);try{const response=await client.request("drawingShares",{method:"POST",headers:{"Content-Type":"application/json"},body});const result=await response.json();if(!response.ok)throw new Error(result.error||t.shareFailed);setMessage(t.shared(result.count));client.notify("drawings");}catch(error){setError(true);setMessage(error instanceof Error?error.message:t.shareFailed);}finally{setBusy(false);}
 }}>
 <label htmlFor="drawing-share-name" className="block text-[11px]">{t.name}</label><Input id="drawing-share-name" value={name} maxLength={160} required disabled={busy} onChange={event=>setName(event.target.value)}/>
 <p className="text-[10px] text-[color:var(--sdk-muted,#64748b)]">{selected?t.scopeSelected:t.scopeAll}{t.notice}</p>
 <Button size="sm" className="w-full" disabled={!ready||busy||!drawings.length}>{busy?t.busy:t.submit}</Button>
 </form>{message&&<p role={error?"alert":"status"} className={`text-[11px] ${error?"text-[color:var(--sdk-danger,#dc2626)]":"text-[color:var(--sdk-primary,#0f766e)]"}`}>{message}</p>}
 </section>;
}
