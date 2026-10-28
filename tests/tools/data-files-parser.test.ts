import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {csvData,kmlData,validateData,parseDataFile,declareMissingPrefixes,DATA_RETENTION_MS} from '../../src/tools/data-files/data-files.js';

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
test('KML exported by Google Earth/ArcGIS: undeclared xsi prefix, attribute table in description, ExtendedData',()=>{
 const html=`<html xmlns:fo="http://www.w3.org/1999/XSL/Format"><body style="margin:0px"><table><tr><td>บึงปากจาบ</td></tr><tr><td><table>
<tr><td>FID</td><td>0</td></tr><tr bgcolor="#D4E4F3"><td>PROV_Name</td><td>ชัยภูมิ</td></tr><tr><td>AREA</td><td>157165</td></tr><tr><td>__proto__</td><td>x</td></tr><tr><td>Note</td><td>a &amp; b</td></tr></table></td></tr></table></body></html>`;
 const kml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document id="d" xsi:schemaLocation="http://www.opengis.net/kml/2.2 x.xsd"><Folder>
<Placemark><name> บึงปากจาบ </name><description><![CDATA[${html}]]></description><MultiGeometry><Polygon><outerBoundaryIs><LinearRing><coordinates>101.9,16.6,0 101.95,16.6,0 101.95,16.65,0 101.9,16.6,0 </coordinates></LinearRing></outerBoundaryIs></Polygon></MultiGeometry></Placemark>
<Placemark><name>b</name><description>&lt;b&gt;ลึก&lt;/b&gt; 3 m</description><ExtendedData><Data name="depth"><value>3</value></Data><SchemaData><SimpleData name="code">W2</SimpleData></SchemaData></ExtendedData><Point><coordinates>100,13</coordinates></Point></Placemark>
</Folder></Document></kml>`;
 assert.match(declareMissingPrefixes(kml),/<kml xmlns:xsi="urn:x-undeclared:xsi" xmlns=/);
 assert.equal(declareMissingPrefixes('<kml xmlns:xsi="u"><a xsi:b="1"/></kml>'),'<kml xmlns:xsi="u"><a xsi:b="1"/></kml>','declared prefixes are left alone');
 const [lake,point]=kmlData(kml).features;
 assert.deepEqual(lake.properties,{name:'บึงปากจาบ',FID:'0',PROV_Name:'ชัยภูมิ',AREA:'157165',Note:'a & b'});
 assert.equal(lake.geometry.type,'Polygon');
 assert.deepEqual(point.properties,{name:'b',description:'ลึก 3 m',depth:'3',code:'W2'});
});
