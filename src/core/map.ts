import type {FeatureCollection} from 'geojson';
export type Coordinate=[number,number];
export type MapEvent="move"|"moveend"|"resize"|"load";
export type MapPointerEventName="click"|"pointermove";
/** `features` lists hits on layers drawn through this adapter's GeoJSON surface, topmost first, by registry layer ID. */
export type MapPointerEvent={lngLat:{lng:number;lat:number};point:{x:number;y:number};features:{layerId:string;properties:Record<string,unknown>}[]};
export type GeoJSONStyle={kind:"fill"|"line"|"circle"|"mixed";color:string;opacity:number;cluster?:boolean;minZoom?:number;maxZoom?:number};
/** Engine-neutral GeoJSON rendering keyed by registry layer ID. Data is bounded by the caller. */
export interface GeoJSONSurface {
 /** Creates or updates the layer; a URL string lets the engine fetch a small static file. */
 set(id:string,data:FeatureCollection|string,style:GeoJSONStyle):void;
 remove(id:string):void;
 setVisible(id:string,visible:boolean):void;
 setOpacity(id:string,opacity:number):void;
 /** Registry order, first = top. IDs the surface does not hold are skipped. */
 order(ids:readonly string[]):void;
 /** Engine layer IDs behind a registry layer, for hit testing or host-side identify. */
 layerIds(id:string):string[];
}
export interface MapAdapter {
 getSize():{width:number;height:number};
 getZoom():number;
 getBounds():{getWest():number;getSouth():number;getEast():number;getNorth():number}|null;
 project(coordinate:Coordinate):{x:number;y:number};
 unproject(point:Coordinate):{lng:number;lat:number};
 navigate(view:{longitude:number;latitude:number;zoom:number}):void;
 fitBounds(bounds:[Coordinate,Coordinate]):void;
 on(event:MapEvent,listener:()=>void):void;
 off(event:MapEvent,listener:()=>void):void;
 /** Optional (capability `map.pointer`). */
 onPointer?(event:MapPointerEventName,listener:(event:MapPointerEvent)=>void):void;
 offPointer?(event:MapPointerEventName,listener:(event:MapPointerEvent)=>void):void;
 /** Optional element that HTML/SVG overlays may be positioned against. */
 getContainer?():HTMLElement|null;
 /** Optional (capability `map.geojson`). */
 geojson?:GeoJSONSurface;
 /** Cleanup only listeners and layers owned by this adapter; never destroy the host map. */
 dispose():void;
}
