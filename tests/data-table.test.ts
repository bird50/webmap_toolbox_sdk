import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Feature} from 'geojson';
import {cellText,columnKind,matchesQuery,numericValue,summarizeColumn,tableColumns} from '../src/core/data-table.js';

const row=(properties:Record<string,unknown>):Feature=>({type:'Feature',properties,geometry:{type:'Point',coordinates:[100,13]}});
const rows=[row({name:'A',area:'1,000',kind:'x'}),row({name:'B',area:2500,kind:'y',extra:true}),row({name:'C',area:'',kind:'x'}),row({name:'D',area:4000,kind:'x'})];

test('columns: preferred first, then other properties, bounded',()=>{
 assert.deepEqual(tableColumns(rows,['kind','missing']),['kind','name','area','extra']);
 assert.deepEqual(tableColumns(rows,[],2),['name','area']);
 assert.deepEqual(tableColumns([],['a','b']),['a','b']);
});
test('numbers: numeric strings with separators count, text does not',()=>{
 assert.equal(numericValue('1,250'),1250);assert.equal(numericValue('-3.5'),-3.5);assert.equal(numericValue(7),7);
 for(const value of ['2.84 m','',null,NaN,'1e3x',true])assert.equal(numericValue(value),undefined);
 assert.equal(columnKind(rows,'area'),'number');assert.equal(columnKind(rows,'name'),'category');
 assert.equal(cellText(null),'');assert.equal(cellText({a:1}),'{"a":1}');
});
test('search matches any property value, case-insensitively',()=>{
 assert.equal(rows.filter(feature=>matchesQuery(feature,' b ')).length,1);
 assert.equal(rows.filter(feature=>matchesQuery(feature,'')).length,4);
});
test('summaries: histogram bins cover every number, categories keep the top groups',()=>{
 const numeric=summarizeColumn(rows,'area',{bins:3});
 assert.equal(numeric.kind,'number');
 if(numeric.kind!=='number')return;
 assert.deepEqual([numeric.count,numeric.min,numeric.max,numeric.mean],[3,1000,4000,2500]);
 assert.deepEqual(numeric.bins.map(bin=>bin.count),[1,1,1]);
 assert.equal(numeric.bins.at(-1)!.to,4000);
 assert.equal(summarizeColumn(rows,'area').kind==='number'&&(summarizeColumn(rows,'area') as {bins:unknown[]}).bins.length,3,'Sturges: 3 values → 3 bins');
 const flat=summarizeColumn([row({v:5}),row({v:5})],'v');
 assert.equal(flat.kind==='number'&&flat.bins.length,1);
 const category=summarizeColumn(rows,'kind',{top:1});
 assert.deepEqual(category,{kind:'category',count:4,distinct:2,bins:[{label:'x',count:3}],other:1});
});
