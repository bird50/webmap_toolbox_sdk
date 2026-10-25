import {useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Map,{NavigationControl,type MapRef} from 'react-map-gl/maplibre';
import {createPublicClient,type LayerDefinition} from '@thaiwater/toolbox-sdk';
import {createBrowserStorage,type StoredPhoto} from '@thaiwater/toolbox-sdk/storage';
import {ToolboxProvider,WorkspacePanels,LayerPanel,useLayerRegistry,PhotoSettings,PublicPhotoSettings,DrawingWorkspace,DataFilesSettings,useDataFiles,PhotoTool,DrawTool,DataFilesTool} from '@thaiwater/toolbox-sdk/react';
import {MapLibreToolboxBridge,PhotoLayers,RegistryLayers,type MapPhoto,type PublicPhotoStatus} from '@thaiwater/toolbox-sdk/maplibre';
import {emptyPublicPhotoFilters} from '@thaiwater/toolbox-sdk/core/public-photo-query';
import type {GeotaggedPhoto} from '@thaiwater/toolbox-sdk/core/photo-gps';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@thaiwater/toolbox-sdk/styles.css';
const runtime={appId:'portable-example',storage:createBrowserStorage('portable-example'),client:createPublicClient({baseUrl:new URLSearchParams(location.search).get('gateway')||undefined})};
const base:LayerDefinition={id:'',title:'',description:'SDK demo',group:'Toolbox',type:'GEOJSON',url:'local:',visible:false,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#0f766e',legend:'',popupFields:[]};
const initial:LayerDefinition[]=[
 {...base,id:'my-photos',title:'My Photos',photoDataKey:'my-photos'},
 {...base,id:'public-photos',title:'Public Photos',url:'/api/public/photos',photoDataKey:'public-photos',color:'#0284c7'},
 {...base,id:'my-drawing',title:'My Drawing',drawingDataKey:'my-drawing',color:'#dc2626'},
 {...base,id:'public-drawing',title:'Public Drawing',url:'/api/public/drawings',drawingDataKey:'public-drawing'},
 {...base,id:'my-data-files',title:'My Data Files',render:{kind:'mixed',dataKey:'my-data-files'}}
];
function Workspace(){
 const state=useLayerRegistry(initial,'PUBLIC');const layers=useMemo(()=>[...state.layers],[state.layers]);const {visible,opacity,registry}=state;
 const map=useRef<MapRef>(null);const [drawOpen,setDrawOpen]=useState(false),[count,setCount]=useState(0);
 const [photoOpen,setPhotoOpen]=useState(false),[publicOpen,setPublicOpen]=useState(false),[filesOpen,setFilesOpen]=useState(false);
 const filesTrigger=useRef<HTMLButtonElement|null>(null),publicTrigger=useRef<HTMLButtonElement|null>(null);
 const [photos,setPhotos]=useState<(StoredPhoto&MapPhoto)[]>([]);const urls=useRef<string[]>([]);
 const [ready,setReady]=useState(false),[notice,setNotice]=useState('');const [filters,setFilters]=useState(emptyPublicPhotoFilters);
 const [status,setStatus]=useState<PublicPhotoStatus>({count:0,loading:false,error:'',hasMore:false});
 const files=useDataFiles('demo-user');
 useEffect(()=>{let cancelled=false;const refresh=()=>{runtime.storage.photos.loadPhotos('demo-user').then(result=>{if(cancelled)return;urls.current.forEach(URL.revokeObjectURL);const records=result.photos.map(p=>({...p,url:URL.createObjectURL(p.blob)}));urls.current=records.map(p=>p.url);setPhotos(records);setReady(true);}).catch(()=>setNotice('อ่านที่เก็บภาพไม่สำเร็จ'));};refresh();const timer=setInterval(refresh,60000);return ()=>{cancelled=true;clearInterval(timer);urls.current.forEach(URL.revokeObjectURL);};},[]);
 async function addPhotos(selected:GeotaggedPhoto[]){const records=await runtime.storage.photos.savePhotos('demo-user',selected);const added=records.map(p=>({...p,url:URL.createObjectURL(p.blob)}));urls.current.push(...added.map(p=>p.url));setPhotos(old=>[...old,...added]);registry.setVisible('my-photos',true);if(added[0])map.current?.flyTo({center:[added[0].longitude,added[0].latitude],zoom:12});return records;}
 const toolbox=<div className="space-y-4"><h2>Toolbox</h2><PhotoTool count={photos.length} layerVisible={!!visible['my-photos']} onLayerVisible={v=>registry.setVisible('my-photos',v)} myPhotoSettingsOpen={photoOpen} onMyPhotoSettings={()=>setPhotoOpen(true)} publicVisible={!!visible['public-photos']} onPublicVisible={v=>registry.setVisible('public-photos',v)} publicStatus={status} publicSettingsOpen={publicOpen} onPublicSettings={el=>{publicTrigger.current=el;setPublicOpen(true);}} filterCount={0}/><DrawTool drawingLayers={layers.filter(l=>l.drawingDataKey)} visible={visible} drawingCount={count} onDrawingVisible={registry.setVisible} drawingToolbarOpen={drawOpen} onDrawingToolbarChange={v=>{setDrawOpen(v);if(v)registry.setVisible('my-drawing',true);}}/><DataFilesTool dataFilesCount={files.files.length} dataFilesVisible={!!visible['my-data-files']} onDataFilesVisible={v=>registry.setVisible('my-data-files',v)} dataFilesOpen={filesOpen} onDataFilesSettings={el=>{filesTrigger.current=el;setFilesOpen(true);}}/></div>;
 return <><WorkspacePanels style={{height:'100dvh'}} layer={<LayerPanel registry={registry}/>} toolbox={toolbox} map={<Map ref={map} initialViewState={{longitude:100.5,latitude:13.5,zoom:5}} mapStyle={{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#e2e8f0'}}]}}><NavigationControl/><MapLibreToolboxBridge><DrawingWorkspace userId="demo-user" open={drawOpen} onClose={()=>setDrawOpen(false)} layers={layers} visible={visible} opacity={opacity} onCount={setCount} onEnsureVisible={()=>registry.setVisible('my-drawing',true)}/><PhotoLayers layers={layers} photos={photos} visible={visible} opacity={opacity} publicFilters={filters} onPublicStatus={setStatus}/><RegistryLayers layers={layers} visible={visible} opacity={opacity} data={{'my-data-files':files.data}}/></MapLibreToolboxBridge></Map>}/><PhotoSettings open={photoOpen} onOpenChange={setPhotoOpen} onAdd={addPhotos} storageReady={ready} storageMessage={notice} savedPhotos={photos}/><PublicPhotoSettings open={publicOpen} onOpenChange={setPublicOpen} filters={filters} onApply={f=>{setFilters(f);registry.setVisible('public-photos',true);}} returnFocusRef={publicTrigger}/><DataFilesSettings open={filesOpen} onOpenChange={setFilesOpen} store={files} returnFocus={filesTrigger} onAdded={()=>registry.setVisible('my-data-files',true)}/></>;
}
createRoot(document.getElementById('root')!).render(<ToolboxProvider runtime={runtime}><Workspace/></ToolboxProvider>);
