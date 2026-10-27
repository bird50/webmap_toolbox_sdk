"use client";
import {dataFilesTh} from "./messages/dataFiles.js";
import {useCallback,useEffect,useRef,useState} from "react";
import type {DataFileChange,StoredDataFile} from "../storage/data-file-storage.js";
import {useToolStorage,useToolText} from "./context.js";
import {createDataFileStorage} from "../storage/data-file-storage.js";
import {storageName} from "../storage/names.js";
/** Data file sets of `userId` in this browser, newest first; `refresh(change)` applies a change and returns the sets. */
export function useDataFiles(userId:string){
 const dataFileTransaction=useToolStorage("files",appId=>createDataFileStorage(storageName(appId,"files")));
 const [files,setFiles]=useState<StoredDataFile[]>([]);const [ready,setReady]=useState(false);const [error,setError]=useState("");const version=useRef(0);
 const t=useToolText("dataFiles",dataFilesTh);const messages=useRef(t);messages.current=t;
 const refresh=useCallback(async(change?:DataFileChange)=>{
  const current=++version.current;
  try{const saved=await dataFileTransaction(userId,change);if(current===version.current){setFiles(saved);setError("");setReady(true);}return saved;}
  catch(error){if(current===version.current)setError(error instanceof Error?error.message:messages.current.accessFailed);throw error;}
 },[userId,dataFileTransaction]);
 useEffect(()=>{
  const revision=version;
  const load=()=>{setFiles(current=>current.filter(file=>file.expiresAt>Date.now()));void refresh().catch(()=>{});};load();
  const timer=window.setInterval(load,60000);const focus=()=>{if(document.visibilityState==="visible")load();};
  document.addEventListener("visibilitychange",focus);
  return ()=>{revision.current++;window.clearInterval(timer);document.removeEventListener("visibilitychange",focus);};
 },[refresh]);
 return {files,ready,error,refresh};
}
