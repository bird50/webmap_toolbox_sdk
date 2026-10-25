"use client";

import {useRef} from "react";

/** Pointer capture keeps dragging reliable over the map and outside the handle. */
export function PanelSplitter({label,axis,value,min,max,direction=1,onChange,className=""}:{label:string;axis:"x"|"y";value:number;min:number;max:number;direction?:1|-1;onChange:(value:number)=>void;className?:string}) {
  const drag=useRef<{pointer:number;position:number;value:number}|null>(null);
  const update=(next:number)=>onChange(Math.round(Math.max(min,Math.min(max,next))));
  return <div role="separator" aria-label={label} aria-orientation={axis==="x"?"vertical":"horizontal"} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(Math.max(min,Math.min(max,value)))} tabIndex={0}
    className={`panel-splitter panel-splitter-${axis} ${className}`}
    onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current={pointer:event.pointerId,position:axis==="x"?event.clientX:event.clientY,value:Math.max(min,Math.min(max,value))};}}
    onPointerMove={event=>{if(drag.current?.pointer!==event.pointerId)return;update(drag.current.value+((axis==="x"?event.clientX:event.clientY)-drag.current.position)*direction);}}
    onPointerUp={event=>{if(drag.current?.pointer===event.pointerId){drag.current=null;event.currentTarget.releasePointerCapture(event.pointerId);}}}
    onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
    onKeyDown={event=>{const backward=axis==="x"?"ArrowLeft":"ArrowUp";const forward=axis==="x"?"ArrowRight":"ArrowDown";if(event.key===backward||event.key===forward){event.preventDefault();update(value+(event.key===forward?1:-1)*direction*(event.shiftKey?40:10));}else if(event.key==="Home"||event.key==="End"){event.preventDefault();update(event.key==="Home"?min:max);}}}
  ><span/></div>;
}
