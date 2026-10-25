export type LayerType="GEOJSON"|"VECTOR_TILE"|"RASTER_TILE"|"WMS"|"WFS"|"ARCGIS_REST"|"REST_API";
export type AccessLevel="PUBLIC"|"MEMBER"|"ADMIN";
export type LayerDefinition={id:string;title:string;description:string;group:string;type:LayerType;url:string;visible:boolean;opacity:number;minZoom:number;maxZoom:number;accessLevel:AccessLevel;color:string;legend:string;drawingDataKey?:"my-drawing"|"public-drawing";photoDataKey?:"my-photos"|"public-photos";toolboxId?:string;render?:{kind:"fill"|"circle"|"line"|"mixed";cluster?:boolean;dataKey?:string};popupFields:string[]};
