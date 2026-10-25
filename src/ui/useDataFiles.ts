"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {FeatureCollection} from "geojson";
import type {StoredDataFile} from "../storage/data-file-storage.js";
import {useToolMessages,useToolbox} from "./context.js";
export function useDataFiles(userId:string){
 const {storage}=useToolbox();const dataFileTransaction=storage.files;
 const [files,setFiles]=useState<StoredDataFile[]>([]);const [ready,setReady]=useState(false);const [error,setError]=useState("");const version=useRef(0);
 const t=useToolMessages().dataFiles;const messages=useRef(t);messages.current=t;
 const refresh=useCallback(async(change?:Parameters<typeof dataFileTransaction>[1])=>{
  const current=++version.current;
  try{const saved=await dataFileTransaction(userId,change);if(current===version.current){setFiles(saved);setError("");setReady(true);}}
  catch(error){if(current===version.current)setError(error instanceof Error?error.message:messages.current.accessFailed);throw error;}
 },[userId,dataFileTransaction]);
 useEffect(()=>{
  const revision=version;
  const load=()=>{setFiles(current=>current.filter(file=>file.expiresAt>Date.now()));void refresh().catch(()=>{});};load();
  const timer=window.setInterval(load,60000);const focus=()=>{if(document.visibilityState==="visible")load();};
  document.addEventListener("visibilitychange",focus);
  return ()=>{revision.current++;window.clearInterval(timer);document.removeEventListener("visibilitychange",focus);};
 },[refresh]);
 const data=useMemo<FeatureCollection>(()=>({type:"FeatureCollection",features:files.flatMap(file=>file.data.features.map(feature=>({...feature,properties:{...feature.properties,data_file:file.name,file_description:file.description}})))}),[files]);
 return {files,ready,error,data,refresh};
}
