"use client";
import {useEffect} from "react";
import {Source,Layer,useMap,type LayerProps} from "react-map-gl/maplibre";
import type {FeatureCollection} from "geojson";
import type {LayerDefinition} from "../core/layers.js";
import {registryLayerSpecs} from "./maplibre-geojson.js";

const specsFor=(layer:LayerDefinition,opacity=layer.opacity)=>layer.render?registryLayerSpecs(layer.id,{kind:layer.render.kind,color:layer.color,opacity}):[];
export function interactiveRegistryIds(layers:readonly LayerDefinition[],visible:Record<string,boolean>) {
  return layers.filter(layer=>layer.render&&layer.url&&visible[layer.id]).flatMap(layer=>specsFor(layer).map(spec=>spec.id));
}
/** Remote APIs must supply bounded viewport data through dataKey, never fetch full datasets here. */
export function RegistryLayers({layers,visible,opacity,data}:{layers:readonly LayerDefinition[];visible:Record<string,boolean>;opacity:Record<string,number>;data:Record<string,FeatureCollection>}) {
  const {current:map}=useMap();
  useEffect(()=>{
    if(!map)return;
    const order=()=>{for(const layer of [...layers].reverse()){
      if(!layer.render||!visible[layer.id])continue;
      for(const {id} of specsFor(layer))if(map.getLayer(id))map.moveLayer(id);
    }};
    order();map.once("idle",order);
    return ()=>{map.off("idle",order);};
  },[map,layers,visible]);
  return layers.filter(layer=>layer.render&&layer.url&&visible[layer.id]).map(layer=>{
    const render=layer.render!;
    const source=render.dataKey?data[render.dataKey]:layer.type==="GEOJSON"?layer.url:undefined;
    if(!source)return null;
    return <Source key={layer.id} id={`source-${layer.id}`} type="geojson" data={source} cluster={render.kind==="circle"&&render.cluster} clusterRadius={45}>
      {specsFor(layer,opacity[layer.id]??layer.opacity).map(spec=><Layer key={spec.id} {...{...spec,minzoom:layer.minZoom,maxzoom:layer.maxZoom} as LayerProps}/>)}
    </Source>;
  });
}
