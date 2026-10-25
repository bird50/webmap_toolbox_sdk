"use client";
import {useLayers,useToolLayers,useToolState,useToolStateOf,useToolUser} from "../context.js";
import {TOOL_API_VERSION,type ToolPlugin} from "../contracts.js";
import {DrawingWorkspace} from "../DrawingWorkspace.js";
import {DrawTool} from "../tools/DrawTool.js";
import {baseLayer,ownedLayer,toolLayer,type ToolLayerOptions,type ToolPluginOptions} from "./shared.js";

export const DRAW_TOOL_ID="toolbox.draw";
/** Drawing toolbar open state, readable by the host (e.g. to make room for the toolbar on small screens). */
export function useDrawingToolbar(toolId=DRAW_TOOL_ID){return useToolStateOf(toolId,"toolbar",false);}

function useShowMine(){
 const mine=ownedLayer(useToolLayers(),"mine"),{registry}=useLayers();
 return ()=>{if(mine)registry.setVisible(mine.id,true);};
}
function Panel(){
 const layers=useToolLayers(),{visible,registry}=useLayers(),showMine=useShowMine();
 const [open,setOpen]=useToolState("toolbar",false),[count]=useToolState("count",0);
 return <DrawTool drawingLayers={[...layers]} visible={visible} onDrawingVisible={(id,value)=>registry.setVisible(id,value)} drawingToolbarOpen={open} onDrawingToolbarChange={value=>{setOpen(value);if(value)showMine();}} drawingCount={count}/>;
}
/** SVG drawing overlay and toolbar; uses only the MapAdapter (viewport, projection, events). */
function Overlay(){
 const layers=useToolLayers(),{visible,opacity}=useLayers(),showMine=useShowMine();
 const [open,setOpen]=useToolState("toolbar",false),[,setCount]=useToolState("count",0);
 return <DrawingWorkspace userId={useToolUser().id} open={open} onClose={()=>setOpen(false)} layers={[...layers]} visible={visible} opacity={opacity} onEnsureVisible={showMine} onCount={setCount}/>;
}
/** My Drawing (browser, 15 days from save) and the read-only Public Drawing viewport layer. */
export function drawTool({id=DRAW_TOOL_ID,title="Draw",accessLevel="MEMBER",mine,shared}:ToolPluginOptions&{mine?:ToolLayerOptions;shared?:ToolLayerOptions}={}):ToolPlugin{
 return {id,title,version:"2.0.0",apiVersion:TOOL_API_VERSION,accessLevel,requires:["map.viewport","map.project","map.events"],
  layers:[
   ...toolLayer(id,"mine",{...baseLayer,id:"my-drawing",title:"My Drawing",description:"ชั้นข้อมูลรูปวาดของฉัน",group:"ข้อมูลของฉัน",url:"local:my-drawing",color:"#dc2626",legend:"My Drawing",popupFields:["name","description"],drawingDataKey:"my-drawing"},mine),
   ...toolLayer(id,"public",{...baseLayer,id:"public-drawing",title:"Public Drawing",description:"ชั้นข้อมูลรูปวาดสาธารณะ",group:"รูปวาดสาธารณะ",url:"/api/public/drawings",accessLevel:"PUBLIC",color:"#0284c7",legend:"Public Drawing",popupFields:["name","description"],drawingDataKey:"public-drawing"},shared),
  ],
  Panel,Overlay};
}
