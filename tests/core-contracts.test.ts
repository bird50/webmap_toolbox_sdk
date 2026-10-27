import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distance} from '@turf/distance';
import {shapePoints,transformPoints,defaultDrawingStyle,type Coordinate} from '../src/core/drawing.js';
import {drawingSchema,drawingCollection,drawingShareSchema} from '../src/core/drawing-contract.js';
import {publicPhotoQuery,publicPhotoFilters,photoViewportBbox} from '../src/core/public-photo-query.js';
import {automaticShareTag,shareFields} from '../src/core/photo-share.js';

test('rectangle closes its ring and preserves both drag corners',()=>{
 assert.deepEqual(shapePoints('rectangle',[101,15],[100,13]),[[101,15],[100,15],[100,13],[101,13],[101,15]]);
});
test('circle uses equal geodesic radii, is closed, and degenerates to its centre',()=>{
 const center:Coordinate=[100.5,13.5],edge:Coordinate=[100.6,13.6];
 const ring=shapePoints('circle',center,edge),radius=distance(center,edge);
 assert.equal(ring.length,65);assert.deepEqual(ring[0],ring[64]);
 for(const point of ring)assert.ok(Math.abs(distance(center,point)-radius)<1e-8);
 assert.deepEqual(shapePoints('circle',center,center),[center]);
});
test('move preserves relative geometry; resize anchors top left, never inverts and stays finite',()=>{
 const points:Coordinate[]=[[10,20],[30,40],[10,20]];
 assert.deepEqual(transformPoints(points,[0,0],[5,-8],false),[[15,12],[35,32],[15,12]]);
 assert.deepEqual(transformPoints(points,[30,40],[50,60],true),[[10,20],[50,60],[10,20]]);
 const shrunk=transformPoints(points,[30,40],[-100,-100],true);
 assert.ok(shrunk[1][0]>shrunk[0][0]);assert.ok(shrunk[1][1]>shrunk[0][1]);
 assert.deepEqual(transformPoints([[0,0],[100,0]],[100,0],[200,50],true),[[0,0],[200,0]]);
});

const drawing={id:crypto.randomUUID(),tool:'point' as const,points:[[100,13]] as Coordinate[],text:'',style:defaultDrawingStyle,boxWidth:200,boxHeight:100};
test('drawing contract enforces WGS84, closed areas, minimum points, colours and style ranges',()=>{
 assert.equal(drawingSchema.safeParse(drawing).success,true);
 assert.equal(drawingSchema.safeParse({...drawing,points:[[200,13]]}).success,false);
 assert.equal(drawingSchema.safeParse({...drawing,tool:'line'}).success,false);
 assert.equal(drawingSchema.safeParse({...drawing,tool:'polygon',points:[[100,13],[101,13],[101,14],[100,14]]}).success,false);
 assert.equal(drawingSchema.safeParse({...drawing,tool:'polygon',points:[[100,13],[101,13],[101,14],[100,13]]}).success,true);
 assert.equal(drawingSchema.safeParse({...drawing,style:{...defaultDrawingStyle,color:'red'}}).success,false);
 assert.equal(drawingSchema.safeParse({...drawing,style:{...defaultDrawingStyle,opacity:2}}).success,false);
 assert.equal(drawingSchema.safeParse({...drawing,tool:'select'}).success,false);
 assert.equal(drawingSchema.safeParse({...drawing,text:'x'.repeat(1001)}).success,false);
});
test('drawing collections reject duplicate IDs and >20,000 points; shares need a name and 1–100 items',()=>{
 assert.equal(drawingCollection.safeParse([drawing,drawing]).success,false);
 const line=(n:number)=>({...drawing,id:crypto.randomUUID(),tool:'line' as const,points:Array.from({length:n},(_,i)=>[100,13+i/1e4] as Coordinate)});
 assert.equal(drawingCollection.safeParse(Array.from({length:10},()=>line(2000))).success,true);
 assert.equal(drawingCollection.safeParse([...Array.from({length:10},()=>line(2000)),line(2)]).success,false);
 assert.equal(drawingShareSchema.safeParse({name:'ชุดทดสอบ',drawings:[drawing]}).success,true);
 assert.equal(drawingShareSchema.safeParse({name:'  ',drawings:[drawing]}).success,false);
 assert.equal(drawingShareSchema.safeParse({name:'x',drawings:[]}).success,false);
 assert.equal(drawingShareSchema.safeParse({name:'x',drawings:Array.from({length:101},()=>({...drawing,id:crypto.randomUUID()}))}).success,false);
});
test('public photo query requires a bounded bbox, limits results and validates date ranges',()=>{
 assert.deepEqual(publicPhotoQuery.parse({bbox:'99,12,101,14'}).bbox,[99,12,101,14]);
 assert.equal(publicPhotoQuery.parse({bbox:'99,12,101,14'}).limit,200);
 assert.equal(publicPhotoQuery.parse({bbox:'170,-10,-170,10'}).bbox[0],170);
 for(const bbox of ['','1,2,3','181,0,182,1','0,10,1,5','0,0,0,1','a,b,c,d'])assert.equal(publicPhotoQuery.safeParse({bbox}).success,false);
 assert.equal(publicPhotoQuery.safeParse({bbox:'0,0,1,1',limit:'201'}).success,false);
 assert.equal(publicPhotoFilters.safeParse({startDate:'2026-02-30'}).success,false);
 assert.equal(publicPhotoFilters.safeParse({startDate:'2026-10-02',endDate:'2026-10-01'}).success,false);
 assert.equal(publicPhotoFilters.safeParse({startDate:'2026-10-01',endDate:'2026-10-01'}).success,true);
});
test('viewport bbox wraps longitudes and expands to the whole world beyond 360°',()=>{
 assert.equal(photoViewportBbox(190,-95,200,95),'-170,-90,-160,90');
 assert.equal(photoViewportBbox(-300,0,300,10),'-180,0,180,10');
});
test('share tag uses the Bangkok date and client tags cannot imitate it',()=>{
 assert.equal(automaticShareTag(new Date('2026-10-25T17:30:00Z')),'share2026-10-26');
 assert.equal(shareFields.safeParse({eventName:'น้ำท่วม',tags:['share2026-10-26']}).success,false);
 assert.equal(shareFields.safeParse({eventName:'น้ำท่วม',tags:['ลุ่มน้ำ']}).success,true);
 assert.equal(shareFields.safeParse({eventName:' ',tags:[]}).success,false);
});
