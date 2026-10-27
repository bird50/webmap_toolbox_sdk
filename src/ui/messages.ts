import {photoToolTh} from "./messages/photoTool.js";
import {photoSettingsTh} from "./messages/photoSettings.js";
import {publicPhotoSettingsTh} from "./messages/publicPhotoSettings.js";
import {publicPhotoShareTh} from "./messages/publicPhotoShare.js";
import {photoOverlayTh} from "./messages/photoOverlay.js";
import {photoPluginTh} from "./messages/photoPlugin.js";
import {photoEventsTh} from "./messages/photoEvents.js";
import {photoDataTh} from "./messages/photoData.js";
import {drawingToolbarTh} from "./messages/drawingToolbar.js";
import {drawingWorkspaceTh} from "./messages/drawingWorkspace.js";
import {drawingSetControlsTh} from "./messages/drawingSetControls.js";
import {drawingSetsTh} from "./messages/drawingSets.js";
import {publicDrawingSettingsTh} from "./messages/publicDrawingSettings.js";
import {drawingDataTh} from "./messages/drawingData.js";
import {drawToolTh} from "./messages/drawTool.js";
import {dataFilesSettingsTh} from "./messages/dataFilesSettings.js";
import {dataFilesToolTh} from "./messages/dataFilesTool.js";
import {dataFilesTh} from "./messages/dataFiles.js";
import {dataFilesDataTh} from "./messages/dataFilesData.js";
import {publicDataFilesTh} from "./messages/publicDataFiles.js";
import {navigationTh} from "./messages/navigation.js";
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
