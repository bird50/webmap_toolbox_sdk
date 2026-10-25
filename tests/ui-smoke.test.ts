import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createLayerRegistry} from '../src/core/registry.js';
import type {LayerDefinition} from '../src/core/layers.js';
import {LayerPanel,WorkspacePanels} from '../src/ui/panels.js';
import {ToolboxHost} from '../src/ui/ToolboxHost.js';
import {PhotoTool} from '../src/ui/tools/PhotoTool.js';
import {DrawTool} from '../src/ui/tools/DrawTool.js';
import {DataFilesTool} from '../src/ui/tools/DataFilesTool.js';
import {NavigationTool} from '../src/ui/tools/NavigationTool.js';
import type {WebmapHost,ToolboxDefinition} from '../src/ui/contracts.js';

// Server rendering only: verifies markup, labels and state wiring of the current tool panels without a DOM.
const base:LayerDefinition={id:'',title:'',description:'',group:'test',type:'GEOJSON',url:'local:test',visible:false,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#dc2626',legend:'',popupFields:[]};
const host:WebmapHost={apiVersion:'1.0',accessLevel:'MEMBER',capabilities:['map.navigate','layers.control'],layers:[{...base,id:'a'},{...base,id:'b',url:''}],visible:{a:true,b:true},opacity:{},setLayerVisible(){},setLayerOpacity(){},navigate(){}};
const photo={onMyPhotoSettings(){},myPhotoSettingsOpen:false,count:3,layerVisible:true,onLayerVisible(){},publicVisible:true,onPublicVisible(){},publicStatus:{count:7,loading:false,error:'',hasMore:false},onPublicSettings(){},publicSettingsOpen:true,filterCount:2};

test('PhotoTool shows counts, filter summary, dialog state and each public status',()=>{
 const html=renderToStaticMarkup(h(PhotoTool,photo));
 assert.match(html,/Layer My Photos <span[^>]*>\(3\)/);
 assert.match(html,/\(7\)/);
 assert.match(html,/ใช้เงื่อนไขค้นหา 2 รายการ/);
 assert.match(html,/aria-label="ตั้งค่า Public Photos"[^>]*aria-expanded="true"/);
 assert.match(renderToStaticMarkup(h(PhotoTool,{...photo,publicStatus:{...photo.publicStatus,loading:true}})),/กำลังโหลด Public Photos/);
 assert.match(renderToStaticMarkup(h(PhotoTool,{...photo,publicStatus:{count:0,loading:false,error:'เกิดข้อผิดพลาด',hasMore:false}})),/role="alert"[^>]*>เกิดข้อผิดพลาด/);
 assert.match(renderToStaticMarkup(h(PhotoTool,{...photo,publicStatus:{...photo.publicStatus,hasMore:true}})),/ซูมเข้า/);
 assert.match(renderToStaticMarkup(h(PhotoTool,{...photo,publicStatus:{...photo.publicStatus,count:0}})),/ไม่พบภาพ Public/);
});
test('DrawTool lists drawing layers with per-layer status and the toolbar switch',()=>{
 const layers=[{...base,id:'mine',title:'My Drawing',drawingDataKey:'my-drawing' as const},{...base,id:'shared',title:'Public Drawing',drawingDataKey:'public-drawing' as const}];
 const props={drawingLayers:layers,visible:{mine:true,shared:true},onDrawingVisible(){},drawingToolbarOpen:true,onDrawingToolbarChange(){},drawingCount:4};
 const html=renderToStaticMarkup(h(DrawTool,props));
 assert.match(html,/id="drawing-toolbar-toggle"[^>]*aria-checked="true"|aria-checked="true"[^>]*id="drawing-toolbar-toggle"/);
 assert.match(html,/4 วัตถุ/);
 assert.match(html,/โหลดรูปวาดสาธารณะ/);
 assert.match(renderToStaticMarkup(h(DrawTool,{...props,drawingCount:0})),/ยังไม่มี My Drawing/);
});
test('DataFilesTool and NavigationTool render their state from props/host only',()=>{
 assert.match(renderToStaticMarkup(h(DataFilesTool,{dataFilesCount:5,dataFilesOpen:false,onDataFilesSettings(){},dataFilesVisible:false,onDataFilesVisible(){}})),/Layer My Data Files \(5\)/);
 assert.match(renderToStaticMarkup(h(NavigationTool,{host})),/เปิดอยู่ 1 ชั้นข้อมูล/);
});
test('ToolboxHost mounts only available tools and shows an empty state otherwise',()=>{
 const tool=(id:string,extra:Partial<ToolboxDefinition>={}):ToolboxDefinition=>({id,title:id,version:'1.0.0',apiVersion:'1.0',accessLevel:'PUBLIC',requires:[],Panel:()=>h('p',null,`panel:${id}`),...extra});
 const html=renderToStaticMarkup(h(ToolboxHost,{tools:[tool('ok'),tool('admin',{accessLevel:'ADMIN'}),tool('needs',{requires:['map.events']})],host,services:undefined}));
 assert.match(html,/panel:ok/);assert.doesNotMatch(html,/panel:admin|panel:needs/);
 assert.match(renderToStaticMarkup(h(ToolboxHost,{tools:[tool('admin',{accessLevel:'ADMIN'})],host,services:undefined})),/ไม่มีเครื่องมือ/);
});
test('LayerPanel reflects registry visibility/opacity/order; WorkspacePanels keeps three labelled slots',()=>{
 const registry=createLayerRegistry([{...base,id:'one',title:'หนึ่ง',visible:true,opacity:.4},{...base,id:'two',title:'สอง'}]);
 const html=renderToStaticMarkup(h(LayerPanel,{registry}));
 assert.ok(html.indexOf('หนึ่ง')<html.indexOf('สอง'));
 assert.match(html,/checked=""[^>]*\/>หนึ่ง/);
 assert.match(html,/value="0.4"/);
 assert.match(html,/disabled=""[^>]*aria-label="เลื่อน หนึ่ง ขึ้น"/);
 const panels=(side:'left'|'right')=>renderToStaticMarkup(h(WorkspacePanels,{side,map:'M',layer:'L',toolbox:'T'}));
 assert.deepEqual([...panels('left').matchAll(/aria-label="(\w+) Panel"/g)].map(m=>m[1]),['Layer','Map','Toolbox']);
 assert.deepEqual([...panels('right').matchAll(/aria-label="(\w+) Panel"/g)].map(m=>m[1]),['Map','Layer','Toolbox']);
});
