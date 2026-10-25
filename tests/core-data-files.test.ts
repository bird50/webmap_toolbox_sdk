import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {csvData,kmlData,validateData,parseDataFile,DATA_RETENTION_MS} from '../src/core/data-files.js';

// Node has no DOMParser; the browser implementation is what ships, xmldom stands in for tests only.
globalThis.DOMParser??=DOMParser as unknown as typeof globalThis.DOMParser;

test('CSV supports Thai text, quoted commas, escaped quotes and multiline fields',()=>{
 const result=csvData('lat,lng,name,description\r\n13.5,100.5,"สถานี,หนึ่ง","บรรทัดแรก\nบรรทัดที่สอง ""ทดสอบ"""');
 assert.equal(result.features.length,1);
 assert.deepEqual(result.features[0].geometry,{type:'Point',coordinates:[100.5,13.5]});
 assert.equal(result.features[0].properties?.name,'สถานี,หนึ่ง');
 assert.equal(result.features[0].properties?.description,'บรรทัดแรก\nบรรทัดที่สอง "ทดสอบ"');
});
test('CSV accepts header aliases case-insensitively and rejects bad rows instead of dropping them',()=>{
 assert.deepEqual(csvData('Latitude,LONGITUDE\n13,100').features[0].geometry,{type:'Point',coordinates:[100,13]});
 for(const input of ['name\nstation','lat,lon\n,100','lat,lon\n91,100','lat,lon\n13,NaN','lat,lon\n13,100,extra','lat,lon\n13,"100','lat,lat,lon\n13,13,100','lat,lon,__proto__\n13,100,x'])assert.throws(()=>csvData(input));
});
test('GeoJSON preserves mixed geometry and rejects non-WGS84, crs, unclosed polygons and size overflow',()=>{
 const point={type:'Feature',properties:{name:'point'},geometry:{type:'Point',coordinates:[100,13]}};
 const polygon={type:'Feature',properties:null,geometry:{type:'Polygon',coordinates:[[[100,13],[101,13],[101,14],[100,13]]]}};
 assert.equal(validateData({type:'FeatureCollection',features:[point,polygon]}).features.length,2);
 assert.throws(()=>validateData({type:'FeatureCollection',features:[{...point,geometry:{type:'Point',coordinates:[500000,1400000]}}]}));
 assert.throws(()=>validateData({type:'FeatureCollection',crs:{type:'name'},features:[point]}),/crs/);
 assert.throws(()=>validateData({type:'FeatureCollection',features:[{...polygon,geometry:{type:'Polygon',coordinates:[[[100,13],[101,13],[101,14],[100,14]]]}}]}));
 assert.throws(()=>validateData({type:'FeatureCollection',features:[{...point,geometry:{type:'GeometryCollection',geometries:[]}}]}));
 assert.throws(()=>validateData({type:'FeatureCollection',features:[{...point,properties:{nested:{a:1}}}]}));
 assert.throws(()=>validateData({type:'FeatureCollection',features:[]}));
 assert.throws(()=>validateData({type:'FeatureCollection',features:Array(5001).fill(point)}));
 const dense={...point,geometry:{type:'MultiPoint',coordinates:Array(50001).fill([100,13])}};
 assert.throws(()=>validateData({type:'FeatureCollection',features:[dense]}),/50,000/);
});
test('KML reads Point, LineString, Polygon holes and MultiGeometry with text-only properties',()=>{
 const kml=`<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>จุด</name><description>สถานี</description><Point><coordinates>100.5,13.5,0</coordinates></Point></Placemark>
  <Placemark><name>เส้น</name><LineString><coordinates>100,13 101,14</coordinates></LineString></Placemark>
  <Placemark><name>พื้นที่</name><Polygon><outerBoundaryIs><LinearRing><coordinates>100,13 102,13 102,15 100,13</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>100.5,13.2 101,13.2 101,13.6 100.5,13.2</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark>
  <Placemark><name>หลายชิ้น</name><MultiGeometry><Point><coordinates>100,13</coordinates></Point><Point><coordinates>101,14</coordinates></Point></MultiGeometry></Placemark>
 </Document></kml>`;
 const result=kmlData(kml);
 assert.deepEqual(result.features.map(f=>f.geometry.type),['Point','LineString','Polygon','Point','Point']);
 assert.deepEqual(result.features[0].properties,{name:'จุด',description:'สถานี'});
 const polygon=result.features[2].geometry;
 assert.equal(polygon.type==='Polygon'&&polygon.coordinates.length,2);
});
test('KML rejects DTD/entities, non-KML roots, empty coordinates and unsupported geometry',()=>{
 assert.throws(()=>kmlData('<!DOCTYPE kml [<!ENTITY x "y">]><kml/>'),/DTD/);
 assert.throws(()=>kmlData('<gpx><Placemark/></gpx>'),/KML/);
 assert.throws(()=>kmlData('<kml><Placemark><Point><coordinates></coordinates></Point></Placemark></kml>'));
 assert.throws(()=>kmlData('<kml><Placemark><Point><coordinates>100,13 101,14</coordinates></Point></Placemark></kml>'),/Point/);
 assert.throws(()=>kmlData('<kml><Placemark><GroundOverlay/></Placemark></kml>'),/รองรับ/);
});
test('file parser dispatches by extension, strips BOM, wraps single Feature and bounds size/type',async()=>{
 const feature='{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[100,13]}}';
 assert.equal((await parseDataFile(new File(['﻿'+feature],'station.geojson'))).features.length,1);
 assert.equal((await parseDataFile(new File(['lat,lon\n13,100'],'s.CSV'))).features.length,1);
 assert.equal((await parseDataFile(new File(['<kml><Placemark><Point><coordinates>100,13</coordinates></Point></Placemark></kml>'],'s.kml'))).features.length,1);
 await assert.rejects(parseDataFile(new File(['bad'],'bad.json')),/JSON/);
 await assert.rejects(parseDataFile(new File(['bad'],'bad.kmz')),/รองรับ/);
 await assert.rejects(parseDataFile(new File([new Uint8Array(5*1024*1024+1)],'big.csv')),/5 MB/);
 assert.equal(DATA_RETENTION_MS,15*24*60*60*1000);
});
