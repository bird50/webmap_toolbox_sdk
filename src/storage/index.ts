import {createPhotoStorage} from './photo-storage.js';
import {createDrawingStorage} from './drawing-storage.js';
import {createDataFileStorage} from './data-file-storage.js';
export * from './photo-storage.js';
export * from './drawing-storage.js';
export * from './data-file-storage.js';
export function createBrowserStorage(appId:string,legacyNames?:{photos:string;drawings:string;files:string}){
 if(!/^[a-zA-Z0-9._-]{1,100}$/.test(appId))throw new Error('Invalid appId');
 const names=legacyNames??{photos:`toolbox:${appId}:photo:v1`,drawings:`toolbox:${appId}:draw:v1`,files:`toolbox:${appId}:files:v1`};
 return {photos:createPhotoStorage(names.photos),drawings:createDrawingStorage(names.drawings),files:createDataFileStorage(names.files)};
}
export type BrowserStorage=ReturnType<typeof createBrowserStorage>;
