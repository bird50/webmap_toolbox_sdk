"use client";
import {useLayers,useToolLayers} from "../ui/context.js";
import {createPhotoTool,usePhotoToolState,type PhotoToolOptions} from "../ui/plugins/photo.js";
import type {ToolPlugin} from "../ui/contracts.js";
import {PhotoLayers} from "./PhotoLayers.js";

/** Markers and popups through react-map-gl; mount ToolOverlays inside MapLibreToolboxBridge. */
function MapLibrePhotoOverlay(){
 const layers=useToolLayers(),{visible,opacity}=useLayers(),{photos,filters,setStatus}=usePhotoToolState();
 return <PhotoLayers layers={[...layers]} photos={photos} visible={visible} opacity={opacity} onPublicStatus={setStatus} publicFilters={filters}/>;
}
export function photoTool(options?:PhotoToolOptions):ToolPlugin{return createPhotoTool(MapLibrePhotoOverlay,["map.viewport","map.events"],options);}
