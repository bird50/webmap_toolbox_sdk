import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import L from 'leaflet';
import {createLayerRegistry,createPublicClient,type MapAdapter,type MapPointerEvent} from '@thaiwater/toolbox-sdk';
import {createBrowserStorage} from '@thaiwater/toolbox-sdk/storage';
import {ToolboxProvider,WorkspacePanels,LayerPanel,ToolboxPanel,DataPanel,ToolOverlays,ToolDialogs,MapAdapterProvider} from '@thaiwater/toolbox-sdk/react/core';
import {dataFilesTool} from '@thaiwater/toolbox-sdk/tools/data-files';
import {drawTool} from '@thaiwater/toolbox-sdk/tools/draw';
import {navigationTool} from '@thaiwater/toolbox-sdk/tools/navigation';
import {photoTool} from '@thaiwater/toolbox-sdk/tools/photo';
import 'leaflet/dist/leaflet.css';
import '@thaiwater/toolbox-sdk/styles.css';
import {createLeafletAdapter} from './leaflet-adapter';

// Same tools as the MapLibre example: only the map and its adapter differ.
const runtime={appId:'leaflet-example',storage:createBrowserStorage('leaflet-example'),client:createPublicClient({baseUrl:new URLSearchParams(location.search).get('gateway')||undefined})};
const registry=createLayerRegistry([],'MEMBER');
const plugins=[photoTool(),drawTool(),dataFilesTool(),navigationTool()];

function LeafletMap(){
 const element=useRef<HTMLDivElement>(null);
 const [adapter,setAdapter]=useState<MapAdapter>();
 const [hit,setHit]=useState('');
 useEffect(()=>{
  const map=L.map(element.current!,{center:[13.5,100.5],zoom:5,attributionControl:false});
  const next=createLeafletAdapter(map);
  // Demonstrates map.pointer: clicks report GeoJSON features drawn through the adapter's surface.
  const onClick=(event:MapPointerEvent)=>setHit(event.features.length?`${event.features[0].layerId}: ${String(event.features[0].properties.name??'')}`:'');
  next.onPointer?.('click',onClick);setAdapter(next);
  return ()=>{next.dispose();map.remove();};
 },[]);
 return <div style={{position:'relative',height:'100%'}}>
  <div ref={element} style={{position:'absolute',inset:0,background:'#e2e8f0'}}/>
  {adapter&&<MapAdapterProvider adapter={adapter}><div style={{position:'absolute',inset:0,zIndex:1000,pointerEvents:'none'}}><ToolOverlays/></div></MapAdapterProvider>}
  {hit&&<p role="status" style={{position:'absolute',left:12,bottom:12,zIndex:1001,margin:0,padding:'4px 8px',background:'#fff',borderRadius:6,fontSize:12}}>{hit}</p>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<ToolboxProvider runtime={runtime} registry={registry} plugins={plugins} user={{id:'demo-user',accessLevel:'MEMBER'}}>
 <WorkspacePanels style={{height:'100dvh'}} data={<DataPanel/>} layer={<LayerPanel registry={registry}/>} toolbox={<div className="space-y-4"><h2>Toolbox</h2><ToolboxPanel/></div>} map={<LeafletMap/>}/>
 <ToolDialogs/>
</ToolboxProvider>);
