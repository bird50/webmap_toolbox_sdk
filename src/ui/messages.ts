import {photoToolTh} from "./messages/photoTool.js";
import {photoSettingsTh} from "./messages/photoSettings.js";
import {publicPhotoSettingsTh} from "./messages/publicPhotoSettings.js";
import {publicPhotoShareTh} from "./messages/publicPhotoShare.js";
import {photoOverlayTh} from "./messages/photoOverlay.js";
import {photoPluginTh} from "./messages/photoPlugin.js";
import {drawingToolbarTh} from "./messages/drawingToolbar.js";
import {drawingWorkspaceTh} from "./messages/drawingWorkspace.js";
import {drawingShareTh} from "./messages/drawingShare.js";
import {publicDrawingsTh} from "./messages/publicDrawings.js";
import {drawToolTh} from "./messages/drawTool.js";
import {dataFilesSettingsTh} from "./messages/dataFilesSettings.js";
import {dataFilesToolTh} from "./messages/dataFilesTool.js";
import {dataFilesTh} from "./messages/dataFiles.js";
import {navigationTh} from "./messages/navigation.js";
import {layerPanelTh} from "./messages/layerPanel.js";

/**
 * All user-facing UI text, grouped by component. `thMessages` is the default; hosts pass
 * `ToolboxProvider messages` with any subset (each group may itself be partial). Validation errors from
 * core parsers and storage stay Thai and reach the UI as `Error.message`.
 */
export const thMessages={
 noTools:"ไม่มีเครื่องมือที่รองรับพื้นที่ปฏิบัติงานนี้",
 toolFailed:(title:string)=>`เปิดเครื่องมือ ${title} ไม่สำเร็จ กรุณาโหลดหน้าใหม่`,
 layersFailed:(title:string)=>`เพิ่มชั้นข้อมูลของเครื่องมือ ${title} ไม่สำเร็จ เนื่องจากรหัสชั้นข้อมูลซ้ำหรือไม่ถูกต้อง`,
 photoTool:photoToolTh,photoSettings:photoSettingsTh,publicPhotoSettings:publicPhotoSettingsTh,publicPhotoShare:publicPhotoShareTh,photoOverlay:photoOverlayTh,photoPlugin:photoPluginTh,
 drawingToolbar:drawingToolbarTh,drawingWorkspace:drawingWorkspaceTh,drawingShare:drawingShareTh,publicDrawings:publicDrawingsTh,drawTool:drawToolTh,
 dataFilesSettings:dataFilesSettingsTh,dataFilesTool:dataFilesToolTh,dataFiles:dataFilesTh,navigation:navigationTh,layerPanel:layerPanelTh,
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
