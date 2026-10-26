/** Browser calls the application's gateway, never the private service key. */
export function createPublicClient(options:{baseUrl?:string;fetch?:typeof fetch;paths?:Partial<Record<'photos'|'photoShares'|'drawings'|'drawingShares'|'dataFiles'|'dataFileShares',string>>}={}){
 const listeners=new Map<string,Set<()=>void>>();
 const paths={photos:'/api/public/photos',photoShares:'/api/photo-shares',drawings:'/api/public/drawings',drawingShares:'/api/drawing-shares',dataFiles:'/api/public/data-files',dataFileShares:'/api/data-file-shares',...options.paths};
 function url(path:string){return options.baseUrl?new URL(path,options.baseUrl).toString():path;}
 return {paths,url,notify(kind:"photos"|"drawings"|"dataFiles"){listeners.get(kind)?.forEach(fn=>fn());},subscribe(kind:"photos"|"drawings"|"dataFiles",listener:()=>void){let set=listeners.get(kind);if(!set){set=new Set();listeners.set(kind,set);}set.add(listener);return ()=>{set.delete(listener);};},request(kind:keyof typeof paths,init?:RequestInit,query?:URLSearchParams){return (options.fetch??globalThis.fetch)(url(paths[kind])+(query?`?${query}`:''),{credentials:'same-origin',...init});}};
}
export type PublicClient=ReturnType<typeof createPublicClient>;
