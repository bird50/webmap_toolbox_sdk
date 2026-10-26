import {createRoot} from 'react-dom/client';
import Map,{NavigationControl} from 'react-map-gl/maplibre';
import {createLayerRegistry,createPublicClient} from '@thaiwater/toolbox-sdk';
import {createBrowserStorage} from '@thaiwater/toolbox-sdk/storage';
import {ToolboxProvider,WorkspacePanels,LayerPanel,ToolboxPanel,DataPanel,ToolOverlays,ToolDialogs,dataFilesTool,drawTool,navigationTool,photoTool} from '@thaiwater/toolbox-sdk/react';
import {MapLibreToolboxBridge} from '@thaiwater/toolbox-sdk/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@thaiwater/toolbox-sdk/styles.css';

// Everything below is the whole integration: tools own their layers, state, overlays and dialogs.
const runtime={appId:'portable-example',storage:createBrowserStorage('portable-example'),client:createPublicClient({baseUrl:new URLSearchParams(location.search).get('gateway')||undefined})};
// The demo user is a signed-in member; tool layers default to MEMBER access (public layers stay PUBLIC).
const registry=createLayerRegistry([],'MEMBER');
const plugins=[photoTool(),drawTool(),dataFilesTool(),navigationTool()];
const blank={version:8 as const,sources:{},layers:[{id:'background',type:'background' as const,paint:{'background-color':'#e2e8f0'}}]};

createRoot(document.getElementById('root')!).render(<ToolboxProvider runtime={runtime} registry={registry} plugins={plugins} user={{id:'demo-user',accessLevel:'MEMBER'}}>
 <WorkspacePanels style={{height:'100dvh'}} data={<DataPanel/>} layer={<LayerPanel registry={registry}/>} toolbox={<div className="space-y-4"><h2>Toolbox</h2><ToolboxPanel/></div>} map={<Map initialViewState={{longitude:100.5,latitude:13.5,zoom:5}} mapStyle={blank}><NavigationControl/><MapLibreToolboxBridge><ToolOverlays/></MapLibreToolboxBridge></Map>}/>
 <ToolDialogs/>
</ToolboxProvider>);
