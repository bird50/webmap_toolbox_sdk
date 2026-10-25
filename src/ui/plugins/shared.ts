import type {AccessLevel,LayerDefinition} from "../../core/layers.js";

/** Override any field of a tool's default layer, or `false` to leave that layer out. */
export type ToolLayerOptions=Partial<Omit<LayerDefinition,"owner">>|false;
export type ToolPluginOptions={id?:string;title?:string;accessLevel?:AccessLevel};

export function toolLayer(toolId:string,key:string,defaults:Omit<LayerDefinition,"owner">,options?:ToolLayerOptions):LayerDefinition[]{
 return options===false?[]:[{...defaults,...options,owner:{toolId,key}}];
}
export function ownedLayer(layers:readonly LayerDefinition[],key:string){return layers.find(layer=>layer.owner?.key===key);}
export const baseLayer={description:"",type:"GEOJSON",visible:false,opacity:1,minZoom:0,maxZoom:24,accessLevel:"MEMBER",popupFields:[]} as const satisfies Partial<LayerDefinition>;
