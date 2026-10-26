/** Default IndexedDB name for one tool's data of one app: `toolbox:<appId>:<tool>:v1`. */
export function storageName(appId:string,tool:"photo"|"draw"|"files"){
 if(!/^[a-zA-Z0-9._-]{1,100}$/.test(appId))throw new Error('Invalid appId');
 return `toolbox:${appId}:${tool}:v1`;
}
