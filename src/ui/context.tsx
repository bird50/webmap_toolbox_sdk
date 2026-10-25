"use client";
import {createContext,useContext,type ReactNode} from 'react';
import type {MapAdapter} from '../core/map.js';
import type {PublicClient} from '../core/client.js';
import type {BrowserStorage} from '../storage/index.js';
export type ToolboxRuntime={appId:string;storage:BrowserStorage;client:PublicClient};
const Context=createContext<ToolboxRuntime|null>(null);
const MapContext=createContext<MapAdapter|null>(null);
export function ToolboxProvider({runtime,children}:{runtime:ToolboxRuntime;children:ReactNode}){return <Context.Provider value={runtime}>{children}</Context.Provider>;}
export function MapAdapterProvider({adapter,children}:{adapter:MapAdapter;children:ReactNode}){return <MapContext.Provider value={adapter}>{children}</MapContext.Provider>;}
export function useToolbox(){const value=useContext(Context);if(!value)throw new Error('ToolboxProvider is required');return value;}
export function useToolboxMap(){const value=useContext(MapContext);if(!value)throw new Error('MapAdapterProvider is required');return {current:value};}
