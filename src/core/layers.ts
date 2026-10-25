export type LayerType="GEOJSON"|"VECTOR_TILE"|"RASTER_TILE"|"WMS"|"WFS"|"ARCGIS_REST"|"REST_API";
export type AccessLevel="PUBLIC"|"MEMBER"|"ADMIN";
/** Tool that registered the layer; `key` names the tool's data set (defaults to the layer ID). */
export type LayerOwner={toolId:string;key:string};
export type LayerDefinition={id:string;title:string;description:string;group:string;type:LayerType;url:string;visible:boolean;opacity:number;minZoom:number;maxZoom:number;accessLevel:AccessLevel;color:string;legend:string;
 /** @deprecated Host API 1.0 only; tool plugins use `owner`. */drawingDataKey?:"my-drawing"|"public-drawing";
 /** @deprecated Host API 1.0 only; tool plugins use `owner`. */photoDataKey?:"my-photos"|"public-photos";
 toolboxId?:string;owner?:LayerOwner;render?:{kind:"fill"|"circle"|"line"|"mixed";cluster?:boolean;dataKey?:string};popupFields:string[]};
/** True for layers created by a toolbox, under either the 1.0 fields or a 2.0 owner. */
export function isToolLayer(layer:LayerDefinition){return !!(layer.owner||layer.toolboxId||layer.photoDataKey||layer.drawingDataKey);}
