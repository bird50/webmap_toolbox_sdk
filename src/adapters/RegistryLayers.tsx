"use client";
import {useEffect} from "react";
import {Source,Layer,useMap} from "react-map-gl/maplibre";
import type {FeatureCollection} from "geojson";
import type {LayerDefinition} from "../core/layers.js";

export function interactiveRegistryIds(layers:readonly LayerDefinition[],visible:Record<string,boolean>) {
  return layers.filter(layer=>layer.render&&layer.url&&visible[layer.id]).flatMap(layer=>layer.render?.kind==="mixed"?[`registry-${layer.id}-fill`,`registry-${layer.id}-line`,`registry-${layer.id}-point`]:[`registry-${layer.id}`]);
}
/** Remote APIs must supply bounded viewport data through dataKey, never fetch full datasets here. */
export function RegistryLayers({layers,visible,opacity,data}:{layers:readonly LayerDefinition[];visible:Record<string,boolean>;opacity:Record<string,number>;data:Record<string,FeatureCollection>}) {
  const {current:map}=useMap();
  useEffect(()=>{
    if(!map)return;
    const order=()=>{for(const layer of [...layers].reverse()){
      if(!layer.render||!visible[layer.id])continue;
      const prefix=`registry-${layer.id}`;
      const ids=layer.render.kind==="mixed"?[`${prefix}-fill`,`${prefix}-line`,`${prefix}-point`]:[prefix];
      for(const id of ids)if(map.getLayer(id))map.moveLayer(id);
    }};
    order();map.once("idle",order);
    return ()=>{map.off("idle",order);};
  },[map,layers,visible]);
  return layers.filter(layer=>layer.render&&layer.url&&visible[layer.id]).map(layer=>{
    const render=layer.render!;
    const source=render.dataKey?data[render.dataKey]:layer.type==="GEOJSON"?layer.url:undefined;
    if(!source)return null;
    const alpha=opacity[layer.id]??layer.opacity;
    const common={id:`registry-${layer.id}`,minzoom:layer.minZoom,maxzoom:layer.maxZoom};
    return <Source key={layer.id} id={`source-${layer.id}`} type="geojson" data={source} cluster={render.kind==="circle"&&render.cluster} clusterRadius={45}>
      {render.kind==="mixed"?<>
       <Layer {...common} id={`${common.id}-fill`} type="fill" filter={["==","$type","Polygon"]} paint={{"fill-color":layer.color,"fill-opacity":alpha*.3}}/>
       <Layer {...common} id={`${common.id}-line`} type="line" filter={["in","$type","LineString","Polygon"]} paint={{"line-color":layer.color,"line-width":2,"line-opacity":alpha}}/>
       <Layer {...common} id={`${common.id}-point`} type="circle" filter={["==","$type","Point"]} paint={{"circle-color":layer.color,"circle-radius":6,"circle-opacity":alpha,"circle-stroke-color":"#fff","circle-stroke-width":1}}/>
      </>:render.kind==="fill"?<Layer {...common} type="fill" paint={{"fill-color":layer.color,"fill-opacity":alpha*.32,"fill-outline-color":layer.color}}/>:render.kind==="line"?<Layer {...common} type="line" paint={{"line-color":layer.color,"line-width":3,"line-opacity":alpha}}/>:<Layer {...common} type="circle" paint={{"circle-color":layer.color,"circle-radius":["case",["has","point_count"],18,8],"circle-opacity":alpha,"circle-stroke-color":"#fff","circle-stroke-width":2}}/>}
    </Source>;
  });
}
