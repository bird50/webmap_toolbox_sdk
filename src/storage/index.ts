import {createPhotoStorage} from '../tools/photo/photo-storage.js';
import {createDrawingStorage} from '../tools/draw/drawing-storage.js';
import {createDataFileStorage} from '../tools/data-files/data-file-storage.js';
import {storageName} from './names.js';
export * from './names.js';
export * from './expiry.js';
export * from '../tools/photo/photo-storage.js';
export * from '../tools/draw/drawing-storage.js';
export * from '../tools/data-files/data-file-storage.js';
export function createBrowserStorage(appId:string,legacyNames?:{photos:string;drawings:string;files:string}){
 const names=legacyNames??{photos:storageName(appId,'photo'),drawings:storageName(appId,'draw'),files:storageName(appId,'files')};
 return {photos:createPhotoStorage(names.photos),drawings:createDrawingStorage(names.drawings),files:createDataFileStorage(names.files)};
}
export type BrowserStorage=ReturnType<typeof createBrowserStorage>;
