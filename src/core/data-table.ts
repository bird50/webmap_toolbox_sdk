import type {Feature} from 'geojson';

/**
 * Rows a tool or the host offers to the Data Panel: one per feature, columns from its properties.
 * `layerId` ties the source to a registry layer (shown while that layer is visible, ordered like it).
 * Keep `features`, `columns` and `labels` referentially stable between renders.
 */
export type DataSource={
 id:string;
 title:string;
 layerId?:string;
 features:readonly Feature[];
 /** Columns shown first, in this order; other properties follow. */
 columns?:readonly string[];
 /** Column → header text. */
 labels?:Readonly<Record<string,string>>;
 loading?:boolean;
 error?:string;
 /** Short status shown above the table, e.g. that the rows are sample data. */
 note?:string;
};
export type ColumnSummary=
 |{kind:'number';count:number;min:number;max:number;mean:number;bins:{from:number;to:number;count:number}[]}
 |{kind:'category';count:number;distinct:number;bins:{label:string;count:number}[];other:number};

const SCAN=200;
/** Preferred columns first, then other property keys found in the first rows, at most `max`. */
export function tableColumns(features:readonly Feature[],preferred:readonly string[]=[],max=12){
 const keys=new Set<string>();
 for(const feature of features.slice(0,SCAN))for(const key of Object.keys(feature.properties??{}))keys.add(key);
 const first=preferred.filter(key=>keys.has(key)||!features.length);
 return [...new Set([...first,...keys])].slice(0,max);
}
export function cellText(value:unknown){
 if(value===null||value===undefined)return '';
 if(typeof value==='object')return JSON.stringify(value);
 return String(value);
}
/** Numbers and numeric strings ("1,250", "-3.5"); anything else is not a number. */
export function numericValue(value:unknown){
 if(typeof value==='number')return Number.isFinite(value)?value:undefined;
 if(typeof value!=='string'||!/^\s*-?[\d,]*\.?\d+\s*$/.test(value))return undefined;
 const parsed=Number(value.replace(/,/g,''));
 return Number.isFinite(parsed)?parsed:undefined;
}
const filled=(value:unknown)=>value!==null&&value!==undefined&&value!=='';
/** A column is numeric when at least 80% of its non-empty values are numbers. */
export function columnKind(features:readonly Feature[],column:string):'number'|'category'{
 const values=features.map(feature=>feature.properties?.[column]).filter(filled);
 const numbers=values.filter(value=>numericValue(value)!==undefined).length;
 return values.length&&numbers/values.length>=.8?'number':'category';
}
export function matchesQuery(feature:Feature,query:string){
 const text=query.trim().toLowerCase();
 return !text||Object.values(feature.properties??{}).some(value=>cellText(value).toLowerCase().includes(text));
}
/**
 * Histogram (numbers) or top categories, for the Data Panel chart. `bins` defaults to Sturges' rule capped at 10,
 * so a handful of values is not spread over mostly empty bins.
 */
export function summarizeColumn(features:readonly Feature[],column:string,{bins,top=10}:{bins?:number;top?:number}={}):ColumnSummary{
 const values=features.map(feature=>feature.properties?.[column]).filter(filled);
 if(columnKind(features,column)==='number'){
  const numbers=values.map(numericValue).filter((value):value is number=>value!==undefined);
  const min=Math.min(...numbers),max=Math.max(...numbers),mean=numbers.reduce((sum,value)=>sum+value,0)/numbers.length;
  const count=min===max?1:bins??Math.min(10,Math.ceil(Math.log2(numbers.length))+1),width=(max-min)/count||1;
  const result=Array.from({length:count},(_,index)=>({from:min+index*width,to:index===count-1?max:min+(index+1)*width,count:0}));
  for(const value of numbers)result[Math.min(count-1,Math.floor((value-min)/width))].count++;
  return {kind:'number',count:numbers.length,min,max,mean,bins:result};
 }
 const counts=new Map<string,number>();
 for(const value of values){const label=cellText(value);counts.set(label,(counts.get(label)??0)+1);}
 const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const shown=sorted.slice(0,top).map(([label,count])=>({label,count}));
 return {kind:'category',count:values.length,distinct:counts.size,bins:shown,other:sorted.slice(top).reduce((sum,[,count])=>sum+count,0)};
}
