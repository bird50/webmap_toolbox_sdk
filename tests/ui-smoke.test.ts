import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createLayerRegistry} from '../src/core/registry.js';
import type {LayerDefinition} from '../src/core/layers.js';
import {LayerPanel,WorkspacePanels} from '../src/ui/panels.js';
import {PhotoTool} from '../src/ui/tools/PhotoTool.js';
import {DrawTool} from '../src/ui/tools/DrawTool.js';
import {DataFilesTool} from '../src/ui/tools/DataFilesTool.js';

// Server rendering only: verifies markup, labels and state wiring of the current tool panels without a DOM.
const base:LayerDefinition={id:'',title:'',description:'',group:'test',type:'GEOJSON',url:'local:test',visible:false,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#dc2626',legend:'',popupFields:[]};
const photo={onMyPhotoSettings(){},myPhotoSettingsOpen:false,count:3,eventsOnMap:1,publicSetsOnMap:2,onPublicSettings(){},publicSettingsOpen:true};

test('PhotoTool shows counts and dialog state, with settings buttons and no layer switches',()=>{
 const html=renderToStaticMarkup(h(PhotoTool,photo));
 assert.match(html,/My Photos <span[^>]*>\(ชุดบนแผนที่ 1 · รูป 3\)/);
 assert.match(html,/Public Photos <span[^>]*>\(ชุดบนแผนที่ 2\)/);
 assert.doesNotMatch(html,/role="switch"/,'no layer switches');
 assert.match(html,/aria-label="ค้นหาชุดรูปภาพ Public และ Add to map"[^>]*aria-expanded="true"/);
});
test('DrawTool shows the toolbar switch, the draft and set counts, and settings buttons only',()=>{
 const props={drawingToolbarOpen:true,onDrawingToolbarChange(){},drawingCount:4,setCount:3,setsOnMap:2,publicSetsOnMap:1,onSets(){},setsOpen:false,onPublic(){},publicOpen:true};
 const html=renderToStaticMarkup(h(DrawTool,props));
 assert.match(html,/id="drawing-toolbar-toggle"[^>]*aria-checked="true"|aria-checked="true"[^>]*id="drawing-toolbar-toggle"/);
 assert.match(html,/กระดาษร่าง 4 วัตถุ/);
 assert.match(html,/My Drawing <span[^>]*>\(ชุดบนแผนที่ 2 · ชุด 3\)/);
 assert.match(html,/Public Drawing <span[^>]*>\(ชุดบนแผนที่ 1\)/);
 assert.match(html,/aria-label="ค้นหาชุดรูปวาด Public และ Add to map"[^>]*aria-expanded="true"/);
 assert.equal((html.match(/role="switch"/g)??[]).length,1,'only the toolbar switch');
});
test('DataFilesTool renders its state from props only',()=>{
 const html=renderToStaticMarkup(h(DataFilesTool,{setCount:5,setsOnMap:2,onSets(){},setsOpen:false,publicSetsOnMap:1,onPublic(){},publicOpen:true}));
 assert.match(html,/My Data Files <span[^>]*>\(ชุดบนแผนที่ 2 · ชุด 5\)/);
 assert.match(html,/Public Data Files <span[^>]*>\(ชุดบนแผนที่ 1\)/);
 assert.match(html,/aria-label="ค้นหาชุดข้อมูล Public และ Add to map"[^>]*aria-expanded="true"/);
 assert.equal((html.match(/role="switch"/g)??[]).length,0,'no layer switches');
 assert.doesNotMatch(renderToStaticMarkup(h(DataFilesTool,{setCount:0,setsOnMap:0,onSets(){},setsOpen:false})),/Public Data Files/,'Public search is optional');
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
