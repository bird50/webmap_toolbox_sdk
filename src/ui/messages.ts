import {photoToolTh} from "../tools/photo/messages/photoTool.js";
import {photoSettingsTh} from "../tools/photo/messages/photoSettings.js";
import {publicPhotoSettingsTh} from "../tools/photo/messages/publicPhotoSettings.js";
import {publicPhotoShareTh} from "../tools/photo/messages/publicPhotoShare.js";
import {photoOverlayTh} from "../tools/photo/messages/photoOverlay.js";
import {photoPluginTh} from "../tools/photo/messages/photoPlugin.js";
import {photoEventsTh} from "../tools/photo/messages/photoEvents.js";
import {photoDataTh} from "../tools/photo/messages/photoData.js";
import {drawingToolbarTh} from "../tools/draw/messages/drawingToolbar.js";
import {drawingWorkspaceTh} from "../tools/draw/messages/drawingWorkspace.js";
import {drawingSetControlsTh} from "../tools/draw/messages/drawingSetControls.js";
import {drawingSetsTh} from "../tools/draw/messages/drawingSets.js";
import {publicDrawingSettingsTh} from "../tools/draw/messages/publicDrawingSettings.js";
import {drawingDataTh} from "../tools/draw/messages/drawingData.js";
import {drawToolTh} from "../tools/draw/messages/drawTool.js";
import {dataFilesSettingsTh} from "../tools/data-files/messages/dataFilesSettings.js";
import {dataFilesToolTh} from "../tools/data-files/messages/dataFilesTool.js";
import {dataFilesTh} from "../tools/data-files/messages/dataFiles.js";
import {dataFilesDataTh} from "../tools/data-files/messages/dataFilesData.js";
import {publicDataFilesTh} from "../tools/data-files/messages/publicDataFiles.js";
import {navigationTh} from "../tools/navigation/messages/navigation.js";
import {layerPanelTh} from "./messages/layerPanel.js";
import {runtimeTh} from "./messages/runtime.js";
import {dataPanelTh} from "./messages/dataPanel.js";
import {useMessageOverrides} from "./context.js";
import {useMemo} from "react";

/**
 * All user-facing UI text, grouped by component (each group lives in messages/<group>.ts next to nothing else, so a tool entry
 * only pulls in its own text). `thMessages` is the default; hosts pass
 * `ToolboxProvider messages` with any subset (each group may itself be partial). Validation errors from
 * core parsers and storage stay Thai and reach the UI as `Error.message`.
 */
export const thMessages={
 ...runtimeTh,
 photoTool:photoToolTh,photoSettings:photoSettingsTh,publicPhotoSettings:publicPhotoSettingsTh,publicPhotoShare:publicPhotoShareTh,photoOverlay:photoOverlayTh,photoPlugin:photoPluginTh,photoEvents:photoEventsTh,photoData:photoDataTh,
 drawingToolbar:drawingToolbarTh,drawingWorkspace:drawingWorkspaceTh,drawingSetControls:drawingSetControlsTh,drawingSets:drawingSetsTh,publicDrawingSettings:publicDrawingSettingsTh,drawingData:drawingDataTh,drawTool:drawToolTh,
 dataFilesSettings:dataFilesSettingsTh,dataFilesTool:dataFilesToolTh,dataFiles:dataFilesTh,dataFilesData:dataFilesDataTh,publicDataFiles:publicDataFilesTh,navigation:navigationTh,layerPanel:layerPanelTh,dataPanel:dataPanelTh,
};
export type ToolboxMessages=typeof thMessages;
export type ToolboxMessagesOverride={[K in keyof ToolboxMessages]?:ToolboxMessages[K] extends string|((...args:never[])=>unknown)?ToolboxMessages[K]:Partial<ToolboxMessages[K]>};
/** Shallow merge per group, so overriding one string keeps the rest of its group. */
export function mergeMessages(override?:ToolboxMessagesOverride):ToolboxMessages{
 if(!override)return thMessages;
 const merged:Record<string,unknown>={...thMessages};
 for(const [key,value] of Object.entries(override)){
  const base=(thMessages as Record<string,unknown>)[key];
  merged[key]=value&&typeof value==="object"&&base&&typeof base==="object"?{...base,...value}:value??base;
 }
 return merged as ToolboxMessages;
}
/** The complete, merged text set. Tool components read only their own group through `useToolText`. */
export function useToolMessages():ToolboxMessages{const overrides=useMessageOverrides();return useMemo(()=>mergeMessages(overrides),[overrides]);}
