export type Coordinate=[number,number];
export type MapEvent="move"|"moveend"|"resize"|"load";
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
 /** Cleanup only listeners owned by this adapter; never destroy the host map. */
 dispose():void;
}
