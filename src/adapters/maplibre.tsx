"use client";
import {useEffect,useMemo,type ReactNode} from 'react';
import {useMap} from 'react-map-gl/maplibre';
import type {Map as MapLibreMap} from 'maplibre-gl';
import type {MapAdapter,MapEvent} from '../core/map.js';
import {MapAdapterProvider} from '../ui/context.js';
export function createMapLibreAdapter(getMap:()=>MapLibreMap|undefined):MapAdapter{
 const subscriptions=new Set<{map:MapLibreMap;event:MapEvent;listener:()=>void}>();
 const required=()=>{const map=getMap();if(!map)throw new Error('Map is not mounted');return map;};
 return {
 getSize(){const canvas=getMap()?.getCanvas();return {width:canvas?.clientWidth??1,height:canvas?.clientHeight??1};},getZoom:()=>getMap()?.getZoom()??0,getBounds:()=>getMap()?.getBounds()??null,
 project:point=>required().project(point),unproject:point=>required().unproject(point),
 navigate(view){if(!Number.isFinite(view.longitude)||Math.abs(view.longitude)>180||!Number.isFinite(view.latitude)||Math.abs(view.latitude)>90||!Number.isFinite(view.zoom)||view.zoom<0||view.zoom>24)throw new Error('Invalid view');getMap()?.flyTo({center:[view.longitude,view.latitude],zoom:view.zoom});},
 fitBounds(bounds){if(bounds.flat().some(n=>!Number.isFinite(n))||bounds.some(p=>Math.abs(p[0])>180||Math.abs(p[1])>90))throw new Error('Invalid bounds');getMap()?.fitBounds(bounds,{padding:60,maxZoom:14});},
 on(event,listener){const map=getMap();if(!map)return;map.on(event,listener);subscriptions.add({map,event,listener});},
 off(event,listener){for(const item of subscriptions)if(item.event===event&&item.listener===listener){item.map.off(event,listener);subscriptions.delete(item);}},
 dispose(){for(const item of subscriptions)item.map.off(item.event,item.listener);subscriptions.clear();}
 };
}
export function MapLibreToolboxBridge({children}:{children:ReactNode}){
 const {current:map}=useMap();const adapter=useMemo(()=>createMapLibreAdapter(()=>map?.getMap()),[map]);
 useEffect(()=>()=>adapter.dispose(),[adapter]);
 return <MapAdapterProvider adapter={adapter}>{children}</MapAdapterProvider>;
}
