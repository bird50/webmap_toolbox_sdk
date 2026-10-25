"use client";

import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {useToolboxMap as useMap,useToolbox,useToolMessages} from "./context.js";
import {DrawingShareControls} from "./DrawingShareControls.js";
import {usePublicDrawings} from "./usePublicDrawings.js";
import {DrawingToolbar} from "./DrawingToolbar.js";
import {defaultDrawingStyle,dragTools,textTools,shapePoints,screenBounds,transformPoints,MAX_DRAWINGS,MAX_DRAWING_POINTS,type Coordinate,type Drawing,type DrawingStyle,type DrawTool} from "../core/drawing.js";
import type {LayerDefinition} from "../core/layers.js";

type Gesture={start:Coordinate;original?:Drawing;resize?:boolean;points:Coordinate[]};

/** `mine` is the editable browser layer, `shared` the read-only public layer; either may be omitted. */
export function DrawingWorkspace({open,onClose,mine,shared,visible,opacity,onEnsureVisible,onCount,userId}:{open:boolean;onClose:()=>void;mine?:LayerDefinition;shared?:LayerDefinition;visible:Record<string,boolean>;opacity:Record<string,number>;onEnsureVisible:()=>void;onCount:(count:number)=>void;userId:string}) {
  const {current:map}=useMap();
  const runtime=useToolbox();
  const t=useToolMessages().drawingWorkspace;
  const tRef=useRef(t);tRef.current=t;
  const svgRef=useRef<SVGSVGElement>(null);
  const [view,setView]=useState({width:1,height:1,zoom:0});
  const [drawings,setDrawings]=useState<Drawing[]>([]);
  const [storageReady,setStorageReady]=useState(false);
  const [storageMessage,setStorageMessage]=useState(t.storageLoading);
  useEffect(()=>{let cancelled=false;runtime.storage.drawings(userId).then(result=>{if(!cancelled){setDrawings(result.drawings);setStorageReady(true);setStorageMessage(result.expiresAt?tRef.current.storedUntil(new Date(result.expiresAt).toLocaleDateString("th-TH")):tRef.current.storageEmpty);}}).catch(()=>{if(!cancelled){setStorageReady(true);setStorageMessage(tRef.current.storageReadFailed);}});return ()=>{cancelled=true;};},[userId,runtime.storage]);
  async function saveLocal(){try{const result=await runtime.storage.drawings(userId,drawings);setStorageMessage(tRef.current.savedUntil(new Date(result.expiresAt!).toLocaleDateString("th-TH")));}catch{setStorageMessage(tRef.current.saveFailed);}}
  const publicLayer=shared;
  const publicVisible=!!publicLayer&&!!visible[publicLayer.id];
  const publicData=usePublicDrawings(publicLayer,publicVisible);
  const [history,setHistory]=useState<Drawing[][]>([]);
  const [future,setFuture]=useState<Drawing[][]>([]);
  const [tool,setTool]=useState<DrawTool>("select");
  const [style,setStyle]=useState<DrawingStyle>(defaultDrawingStyle);
  const [text,setText]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [draft,setDraft]=useState<Coordinate[]>([]);
  const [preview,setPreview]=useState<Drawing|null>(null);
  const [message,setMessage]=useState("");
  const gesture=useRef<Gesture|null>(null);
  const localLayer=mine;
  const layerVisible=!!localLayer&&!!visible[localLayer.id]&&view.zoom>=localLayer.minZoom&&view.zoom<localLayer.maxZoom;
  const selected=layerVisible?drawings.find(d=>d.id===selectedId):undefined;
  const effectiveTool=open&&storageReady?tool:"pan";
  const capturing=effectiveTool!=="select"&&effectiveTool!=="pan"&&effectiveTool!=="eraser";
  const currentStyle=selected?.style??style;
  const currentText=selected?.text??text;
  const canFinish=(tool==="line"&&draft.length>=2)||(tool==="polygon"&&draft.length>=3);

  useEffect(()=>{
    if(!map)return;
    const refresh=()=>{const size=map.getSize();setView({...size,zoom:map.getZoom()});};
    refresh();map.on("move",refresh);map.on("resize",refresh);
    return ()=>{map.off("move",refresh);map.off("resize",refresh);};
  },[map]);
  useEffect(()=>{onCount(drawings.length);},[drawings.length,onCount]);
  const enabled=open&&storageReady&&layerVisible;
  const [previousEnabled,setPreviousEnabled]=useState(enabled);
  if(previousEnabled!==enabled){setPreviousEnabled(enabled);setDraft([]);setPreview(null);setSelectedId(null);}
  useEffect(()=>{if(!enabled)gesture.current=null;},[enabled]);

  const project=(point:Coordinate):Coordinate=>{const p=map!.project(point);return [p.x,p.y];};
  const unproject=(point:Coordinate):Coordinate=>{const p=map!.unproject(point);return [((p.lng+180)%360+360)%360-180,Math.max(-85.051129,Math.min(85.051129,p.lat))];};
  function position(event:ReactPointerEvent):Coordinate {const bounds=svgRef.current!.getBoundingClientRect();return [event.clientX-bounds.left,event.clientY-bounds.top];}
  function commit(next:Drawing[]) {if(!storageReady)return;setStorageMessage(t.unsaved);setHistory(old=>[...old,drawings].slice(-50));setFuture([]);setDrawings(next);}
  function cancel(){gesture.current=null;setDraft([]);setPreview(null);setMessage("");}
  function undo(){cancel();if(!history.length)return;setFuture(old=>[drawings,...old]);setDrawings(history[history.length-1]);setHistory(old=>old.slice(0,-1));setSelectedId(null);}
  function redo(){cancel();if(!future.length)return;setHistory(old=>[...old,drawings]);setDrawings(future[0]);setFuture(old=>old.slice(1));setSelectedId(null);}
  function remove(){if(selected){commit(drawings.filter(d=>d.id!==selected.id));setSelectedId(null);}}
  function create(points:Coordinate[]):Drawing {
    const number=1+drawings.filter(d=>d.tool==="number").reduce((max,d)=>Math.max(max,Number(d.text)||0),0);
    return {id:crypto.randomUUID(),tool,points,text:tool==="number"?String(number):text.trim(),style:{...style,background:tool==="sticky"?"#fef08a":style.background},boxWidth:tool==="number"?44:200,boxHeight:tool==="number"?44:tool==="label"?48:100};
  }
  function add(drawing:Drawing){if(drawings.length>=MAX_DRAWINGS){setMessage(t.limit(MAX_DRAWINGS));return;}commit([...drawings,drawing]);onEnsureVisible();setMessage("");}
  function finish(){if(canFinish){add(create(tool==="polygon"?[...draft,draft[0]]:draft));setDraft([]);setPreview(null);}}
  function changeTool(next:DrawTool){cancel();setSelectedId(null);setTool(next);if(next!=="pan")onEnsureVisible();}
  function changeStyle(next:DrawingStyle){if(selected)commit(drawings.map(d=>d.id===selected.id?{...d,style:next}:d));else setStyle(next);}
  function changeText(next:string){if(selected)commit(drawings.map(d=>d.id===selected.id?{...d,text:next}:d));else setText(next);}

  useEffect(()=>{
    if(!open)return;
    function key(event:KeyboardEvent){
      const target=event.target as HTMLElement;
      if(target.closest("input,textarea,select,[contenteditable=true]"))return;
      if(event.key==="Escape"){event.preventDefault();cancel();setSelectedId(null);}
      else if(event.key==="Enter"&&canFinish){event.preventDefault();finish();}
      else if((event.key==="Delete"||event.key==="Backspace")&&selected){event.preventDefault();remove();}
      else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();if(event.shiftKey)redo();else undo();}
    }
    window.addEventListener("keydown",key);return ()=>window.removeEventListener("keydown",key);
  });

  function down(event:ReactPointerEvent<SVGSVGElement>){
    if(event.button!==0||!event.isPrimary||!map)return;
    const screen=position(event),geo=unproject(screen);
    const target=(event.target as Element).closest("[data-drawing-id]");
    const drawing=drawings.find(d=>d.id===target?.getAttribute("data-drawing-id"));
    if(effectiveTool==="pan")return;
    event.stopPropagation();event.preventDefault();
    if(effectiveTool==="eraser"){if(drawing)commit(drawings.filter(d=>d.id!==drawing.id));return;}
    if(effectiveTool==="select"){
      if(!drawing){setSelectedId(null);return;}
      setSelectedId(drawing.id);
      gesture.current={start:screen,original:drawing,resize:(event.target as Element).getAttribute("data-resize")==="true",points:[]};
      event.currentTarget.setPointerCapture(event.pointerId);return;
    }
    if(textTools.includes(tool)&&tool!=="number"&&!text.trim()){setMessage(t.textRequired);return;}
    if(tool==="line"||tool==="polygon"){
      if(draft.length>=MAX_DRAWING_POINTS){setMessage(t.draftPointsFull);return;}
      setDraft(old=>[...old,geo]);return;
    }
    if(dragTools.includes(tool)){
      gesture.current={start:screen,points:[geo]};setPreview(create([geo]));event.currentTarget.setPointerCapture(event.pointerId);
    } else add(create([geo]));
  }
  function move(event:ReactPointerEvent<SVGSVGElement>){
    const g=gesture.current;if(!g||!map)return;
    event.stopPropagation();const screen=position(event);
    if(g.original){
      const points=g.original.points.map(project);
      const moved=transformPoints(points,g.start,screen,!!g.resize).map(unproject);
      const dx=screen[0]-g.start[0],dy=screen[1]-g.start[1];
      const isText=textTools.includes(g.original.tool);
      setPreview({...g.original,points:g.resize&&isText?g.original.points:moved,boxWidth:g.resize?Math.max(32,g.original.boxWidth+dx):g.original.boxWidth,boxHeight:g.resize?Math.max(32,g.original.boxHeight+dy):g.original.boxHeight,style:g.resize&&g.original.tool==="point"?{...g.original.style,width:Math.min(40,Math.max(1,g.original.style.width+dx/4))}:g.original.style});
    } else {
      const geo=unproject(screen);
      if(tool==="pen"||tool==="highlighter"){
        const previous=project(g.points[g.points.length-1]);
        if(Math.hypot(screen[0]-previous[0],screen[1]-previous[1])<2)return;
        if(g.points.length<MAX_DRAWING_POINTS)g.points.push(geo);
        else setMessage(t.strokePointsFull);
        setPreview(create([...g.points]));
      } else setPreview(create(shapePoints(tool,g.points[0],geo)));
    }
  }
  function up(event:ReactPointerEvent<SVGSVGElement>){
    const g=gesture.current;if(!g)return;
    event.stopPropagation();gesture.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(preview){
      if(g.original)commit(drawings.map(d=>d.id===g.original!.id?preview:d));
      else if(preview.points.length>=2&&Math.hypot(...([position(event)[0]-g.start[0],position(event)[1]-g.start[1]] as Coordinate))>=3)add(preview);
    }
    setPreview(null);
  }

  function renderDrawing(d:Drawing,temporary=false){
    if(!map||!d.points.length)return null;
    const points=d.points.map(project),first=points[0],last=points[points.length-1];
    const isText=textTools.includes(d.tool),closed=["polygon","rectangle","circle"].includes(d.tool);
    const interactive=!temporary&&open&&storageReady&&(tool==="select"||tool==="eraser");
    const width=d.tool==="highlighter"?Math.max(16,d.style.width*6):d.style.width;
    const path=points.map(p=>p.join(",")).join(" ");
    const alpha=d.style.opacity*(d.tool==="highlighter"?.3:1);
    const anchor=d.tool==="callout"?last:first;
    const angle=Math.atan2(last[1]-first[1],last[0]-first[0]);
    const tip=d.tool==="callout"?first:last;
    const a=d.tool==="callout"?angle+Math.PI:angle;
    const head=`${tip[0]},${tip[1]} ${tip[0]-14*Math.cos(a-.45)},${tip[1]-14*Math.sin(a-.45)} ${tip[0]-14*Math.cos(a+.45)},${tip[1]-14*Math.sin(a+.45)}`;
    return <g key={d.id} data-drawing-id={d.id} role={interactive?"button":undefined} tabIndex={interactive?0:undefined} aria-label={interactive?`${d.tool}: ${d.text||t.drawingFallback}`:undefined} onFocus={()=>{if(interactive&&tool==="select")setSelectedId(d.id);}} onKeyDown={event=>{if(interactive&&event.key==="Enter"){event.preventDefault();event.stopPropagation();if(tool==="eraser")commit(drawings.filter(item=>item.id!==d.id));else setSelectedId(d.id);}}} opacity={alpha} style={{pointerEvents:interactive?"auto":"none",cursor:tool==="eraser"?"not-allowed":"move"}}>
      <title>{d.text||d.tool}</title>
      {isText?<>
        {d.tool==="callout"&&<><polyline points={path} fill="none" stroke={d.style.color} strokeWidth={width}/><polygon points={head} fill={d.style.color}/></>}
        <foreignObject x={anchor[0]} y={anchor[1]} width={d.boxWidth} height={d.boxHeight} transform={`rotate(${d.style.rotation} ${anchor[0]+d.boxWidth/2} ${anchor[1]+d.boxHeight/2})`}>
          <div style={{width:"100%",height:"100%",overflow:"hidden",whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:d.tool==="number"?0:8,color:d.style.color,background:d.tool==="text"?"transparent":d.style.background,border:d.tool==="text"?"none":`${d.style.width}px solid ${d.style.border}`,borderRadius:d.tool==="number"?"50%":d.tool==="label"?16:4,fontFamily:d.style.font,fontSize:d.style.fontSize,lineHeight:1.35,textAlign:d.style.alignment,display:d.tool==="number"?"grid":"block",placeItems:"center",userSelect:"none"}}>
            {d.tool==="legend"?<><strong style={{display:"block",fontSize:".85em"}}>{t.legendTitle}</strong>{d.text.split("\n").filter(Boolean).map((line,i)=><div key={i}><span aria-hidden="true">■ </span>{line}</div>)}</>:d.text}
          </div>
        </foreignObject>
      </>:d.tool==="point"?<circle cx={first[0]} cy={first[1]} r={Math.max(6,width*2)} fill={d.style.color} stroke="white" strokeWidth={2}/>:<>
        {closed?<polygon points={path} fill={d.style.color} fillOpacity={.2} stroke={d.style.color} strokeWidth={width}/>:<polyline points={path} fill="none" stroke={d.style.color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"/>}
        {d.tool==="arrow"&&<polygon points={head} fill={d.style.color}/>}
        {interactive&&<polyline points={path} fill="none" stroke="transparent" strokeWidth={Math.max(14,width)} pointerEvents="stroke"/>}
      </>}
    </g>;
  }
  const shown=drawings.map(d=>preview?.id===d.id?preview:d);
  const selection=selected&&(preview?.id===selected.id?preview:selected);
  function selectionBox(){
    if(!selection||!map)return null;
    const points=selection.points.map(project);
    let b=screenBounds(points);
    if(textTools.includes(selection.tool)){const anchor=selection.tool==="callout"?points[points.length-1]:points[0];b={left:anchor[0],top:anchor[1],right:anchor[0]+selection.boxWidth,bottom:anchor[1]+selection.boxHeight};}
    return <g data-drawing-id={selection.id}><rect x={b.left-5} y={b.top-5} width={Math.max(10,b.right-b.left+10)} height={Math.max(10,b.bottom-b.top+10)} fill="none" stroke="#0d9488" strokeDasharray="4 3" pointerEvents="none"/><rect data-resize="true" x={b.right} y={b.bottom} width={14} height={14} rx={3} fill="white" stroke="#0d9488" strokeWidth={2} style={{pointerEvents:"auto",cursor:"nwse-resize"}}/></g>;
  }
  return <>
    <svg ref={svgRef} aria-label={t.canvas} className="absolute inset-0 z-10" width={view.width} height={view.height} style={{pointerEvents:capturing?"auto":"none",touchAction:effectiveTool==="pan"?"auto":"none",cursor:capturing?"crosshair":undefined}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>cancel()} onLostPointerCapture={()=>{if(gesture.current)cancel();}} onDoubleClick={event=>{if(capturing){event.stopPropagation();event.preventDefault();}}}>
      {publicVisible&&<g opacity={publicLayer?opacity[publicLayer.id]??1:1}>{publicData.drawings.map(d=>renderDrawing(d,true))}</g>}
      <g opacity={localLayer?opacity[localLayer.id]??1:1}>{layerVisible&&shown.map(d=>renderDrawing(d))}{open&&layerVisible&&preview&&!drawings.some(d=>d.id===preview.id)&&renderDrawing(preview,true)}{open&&layerVisible&&draft.length>0&&renderDrawing({...create(draft),id:"draft"},true)}</g>
      {open&&layerVisible&&selectionBox()}
    </svg>
    {publicVisible&&<p role={publicData.error?"alert":"status"} className="pointer-events-none absolute bottom-10 left-3 z-10 rounded bg-white/90 px-2 py-1 text-xs text-[color:var(--sdk-text-secondary,#334155)]">{publicData.message}</p>}
    {open&&<DrawingToolbar tool={tool} onTool={changeTool} style={currentStyle} onStyle={changeStyle} text={currentText} onText={changeText} selected={!!selected} selectedTool={selected?.tool} selectedPoints={selection?.points} onDelete={remove} onClose={()=>{cancel();onClose();}} onFinish={finish} onCancel={cancel} canFinish={canFinish} hasDraft={draft.length>0} undo={undo} redo={redo} canUndo={history.length>0} canRedo={future.length>0} message={message} count={drawings.length}><DrawingShareControls drawings={drawings} selected={selected} ready={storageReady} onSave={saveLocal} storageMessage={storageMessage}/></DrawingToolbar>}
  </>;
}
