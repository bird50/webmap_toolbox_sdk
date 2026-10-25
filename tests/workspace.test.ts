import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createToolWorkspaceStore,registerPluginLayers} from '../src/core/workspace.js';
import {createLayerRegistry} from '../src/core/registry.js';
import type {LayerDefinition} from '../src/core/layers.js';
import type {MapAdapter} from '../src/core/map.js';

const layer=(id:string):LayerDefinition=>({id,title:id,description:'',group:'test',type:'GEOJSON',url:'local:test',visible:false,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#000',legend:'',popupFields:[]});
const adapter=()=>({}) as MapAdapter;

test('map slot: last attached wins, detaching falls back, unchanged results do not notify',()=>{
 const store=createToolWorkspaceStore();let changes=0;store.subscribeMap(()=>changes++);
 const a=adapter(),b=adapter();
 store.attachMap(a);store.attachMap(b);assert.equal(store.getMap(),b);assert.equal(changes,2);
 store.detachMap(a);assert.equal(store.getMap(),b);assert.equal(changes,2);
 store.detachMap(b);assert.equal(store.getMap(),undefined);assert.equal(changes,3);
 store.attachMap(a);store.attachMap(a);assert.equal(changes,4);
});
test('state slices are per tool and key, accept updaters, and skip no-op notifications',()=>{
 const store=createToolWorkspaceStore();let photo=0,draw=0;
 store.subscribeState('photo','open',()=>photo++);store.subscribeState('draw','open',()=>draw++);
 assert.equal(store.getState('photo','open',false),false);
 store.setState('photo','open',false,true);store.setState('photo','open',false,(open:boolean)=>open);
 assert.equal(store.getState('photo','open',false),true);assert.equal(store.getState('draw','open',false),false);
 assert.equal(photo,1);assert.equal(draw,0);
 store.setState('draw','open',false,false);assert.equal(draw,1,'first explicit set stores the value even when equal to initial');
 store.setState('draw','open',false,false);assert.equal(draw,1);
});
test('plugin layers keep tool order at either end; a conflicting tool fails alone and dispose removes the rest',()=>{
 const registry=createLayerRegistry([layer('basins')]);
 const plugins=[{id:'files',layers:[layer('my-files')]},{id:'none'},{id:'draw',layers:[layer('my-drawing'),layer('public-drawing')]},{id:'bad',layers:[layer('basins')]}];
 const start=registerPluginLayers(registry,plugins,'start');
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['my-files','my-drawing','public-drawing','basins']);
 assert.deepEqual(Object.keys(start.failed),['bad']);
 start.dispose();assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins']);
 const end=registerPluginLayers(registry,plugins);
 assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins','my-files','my-drawing','public-drawing']);
 end.dispose();end.dispose();assert.deepEqual(registry.getSnapshot().layers.map(l=>l.id),['basins']);
});
