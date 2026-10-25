import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLayerRegistry} from '../src/core/registry.js';
import {isToolLayer,type LayerDefinition} from '../src/core/layers.js';
import {definePlugins,pluginAvailable,mapCapabilities,type ToolPlugin} from '../src/ui/contracts.js';
import type {MapAdapter} from '../src/core/map.js';

const base:LayerDefinition={id:'',title:'',description:'',group:'test',type:'GEOJSON',url:'local:test',visible:false,opacity:1,minZoom:0,maxZoom:24,accessLevel:'PUBLIC',color:'#dc2626',legend:'',popupFields:[]};
const layer=(id:string,extra:Partial<LayerDefinition>={}):LayerDefinition=>({...base,id,...extra});
const ids=(registry:ReturnType<typeof createLayerRegistry>)=>registry.getSnapshot().layers.map(l=>l.id);
function counted(initial:LayerDefinition[]=[],access:LayerDefinition['accessLevel']='MEMBER'){
 const registry=createLayerRegistry(initial,access);let emits=0;registry.subscribe(()=>emits++);
 return {registry,emits:()=>emits};
}

test('registerOwned stamps the owner, honours placement and access, and emits once',()=>{
 const {registry,emits}=counted([layer('basins'),layer('stations')]);
 assert.deepEqual(registry.registerOwned('photo',[layer('my-photos',{visible:true}),layer('admin-only',{accessLevel:'ADMIN'}),layer('public-photos',{owner:{toolId:'other',key:'public'}})],'start'),['my-photos','public-photos']);
 assert.equal(emits(),1);
 assert.deepEqual(ids(registry),['my-photos','public-photos','basins','stations']);
 const [mine,shared]=registry.getSnapshot().layers;
 assert.deepEqual(mine.owner,{toolId:'photo',key:'my-photos'});
 assert.deepEqual(shared.owner,{toolId:'photo',key:'public'});
 assert.equal(registry.getSnapshot().visible['my-photos'],true);
 registry.registerOwned('draw',[layer('my-drawing')],{before:'stations'});
 registry.registerOwned('files',[layer('my-files')],{before:'missing'});
 assert.deepEqual(ids(registry),['my-photos','public-photos','basins','my-drawing','stations','my-files']);
 assert.deepEqual(registry.registerOwned('admin',[layer('x',{accessLevel:'ADMIN'})]),[]);
});
test('registerOwned is all-or-nothing on duplicate IDs, bad metadata or an empty tool ID',()=>{
 const {registry,emits}=counted([layer('basins')]);
 const before=registry.getSnapshot();
 assert.throws(()=>registry.registerOwned('photo',[layer('a'),layer('basins')]),/duplicate/);
 assert.throws(()=>registry.registerOwned('photo',[layer('a'),layer('a')]),/duplicate/);
 assert.throws(()=>registry.registerOwned('photo',[layer('a'),layer('b',{opacity:2})]),/metadata/);
 assert.throws(()=>registry.registerOwned(' ',[layer('a')]),/tool ID/);
 assert.equal(registry.getSnapshot(),before);assert.equal(emits(),0);
});
test('unregisterOwner removes only that tool\'s layers and state in one emit',()=>{
 const {registry,emits}=counted([layer('basins',{visible:true})]);
 registry.registerOwned('photo',[layer('my-photos'),layer('public-photos')]);registry.registerOwned('draw',[layer('my-drawing')]);
 const start=emits();registry.unregisterOwner('photo');
 assert.equal(emits(),start+1);
 assert.deepEqual(ids(registry),['basins','my-drawing']);
 assert.equal('my-photos' in registry.getSnapshot().visible,false);assert.equal(registry.getSnapshot().visible.basins,true);
 registry.unregisterOwner('photo');assert.equal(emits(),start+1);
});
test('update batches visibility/opacity, clamps, ignores unknown IDs and skips no-op emits',()=>{
 const {registry,emits}=counted([layer('a'),layer('b'),layer('c')]);
 registry.update({visible:{a:true,b:true,unknown:true},opacity:{c:5,a:Number.NaN}});
 assert.equal(emits(),1);
 assert.deepEqual(registry.getSnapshot().visible,{a:true,b:true,c:false});
 assert.deepEqual(registry.getSnapshot().opacity,{a:1,b:1,c:1});
 registry.update({visible:{a:true},opacity:{c:1}});registry.setVisible('a',true);registry.setOpacity('b',1);
 assert.equal(emits(),1);
 registry.setOpacity('b',-1);assert.equal(registry.getSnapshot().opacity.b,0);assert.equal(emits(),2);
});
test('isToolLayer accepts 1.0 fields and 2.0 owners only',()=>{
 assert.equal(isToolLayer(layer('a')),false);
 for(const extra of [{owner:{toolId:'t',key:'k'}},{toolboxId:'t'},{photoDataKey:'my-photos' as const},{drawingDataKey:'my-drawing' as const}])assert.equal(isToolLayer(layer('a',extra)),true);
});

const plugin=(id:string,extra:Partial<ToolPlugin>={}):ToolPlugin=>({id,title:id,version:'1.0.0',apiVersion:'2.0',accessLevel:'PUBLIC',requires:[],Panel:()=>null,...extra});
test('Tool API 2.0 checks version, access and capabilities; tool and layer IDs are unique',()=>{
 const environment={apiVersion:'2.0' as const,accessLevel:'MEMBER' as const,capabilities:['map.geojson' as const]};
 assert.equal(pluginAvailable(plugin('a',{requires:['map.geojson']}),environment),true);
 assert.equal(pluginAvailable(plugin('a',{requires:['map.pointer']}),environment),false);
 assert.equal(pluginAvailable(plugin('a',{accessLevel:'ADMIN'}),environment),false);
 assert.equal(pluginAvailable(plugin('a',{apiVersion:'1.0' as '2.0'}),environment),false);
 assert.throws(()=>definePlugins([plugin('a'),plugin('a')]),/duplicate/);
 assert.throws(()=>definePlugins([plugin(' ')]),/Invalid/);
 assert.throws(()=>definePlugins([plugin('a',{layers:[layer('x')]}),plugin('b',{layers:[layer('x')]})]),/more than one tool/);
 assert.equal(definePlugins([plugin('a',{layers:[layer('x')]}),plugin('b')]).length,2);
});
test('mapCapabilities advertises only what an adapter implements',()=>{
 const minimal={getSize:()=>({width:1,height:1}),getZoom:()=>0,getBounds:()=>null,project:()=>({x:0,y:0}),unproject:()=>({lng:0,lat:0}),navigate(){},fitBounds(){},on(){},off(){},dispose(){}} satisfies MapAdapter;
 assert.deepEqual(mapCapabilities(undefined),[]);
 assert.deepEqual(mapCapabilities(minimal),['map.viewport','map.project','map.events']);
 assert.deepEqual(mapCapabilities({...minimal,onPointer(){},getContainer:()=>null}),['map.viewport','map.project','map.events','map.overlay']);
});
