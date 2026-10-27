import {z} from "zod";
import type {FeatureCollection,Geometry,Feature} from "geojson";
import {dataFeature,dataFeatureCollection,MAX_DATA_FEATURES} from "./data-file-share.js";

export const DATA_RETENTION_MS=15*24*60*60*1000;
export const MAX_DATA_BYTES=5*1024*1024;
export function validateData(input:unknown):FeatureCollection {
 if(input&&typeof input==="object"&&"crs" in input&&input.crs)throw new Error("กรุณาแปลงเป็น GeoJSON WGS84 (EPSG:4326) โดยไม่มี crs ก่อนนำเข้า");
 const shape=z.object({type:z.literal("FeatureCollection"),features:z.array(dataFeature).min(1).max(MAX_DATA_FEATURES)}).safeParse(input);
 if(!shape.success)throw new Error("ข้อมูลไม่ถูกต้อง: รองรับ Point/Line/Polygon และ Multi ใน WGS84 ไม่เกิน 5,000 รายการ พร้อม properties แบบข้อความ/ตัวเลข/boolean เท่านั้น");
 const parsed=dataFeatureCollection.safeParse(shape.data);
 if(!parsed.success)throw new Error("เกิน 50,000 จุดพิกัดต่อไฟล์ กรุณาลดขนาดข้อมูล");
 return parsed.data as FeatureCollection;
}

const RESERVED_KEYS=["__proto__","constructor","prototype"];
/** RFC-style quoted CSV fields, including commas, escaped quotes and newlines. */
export function csvData(text:string):FeatureCollection {
 const rows:string[][]=[];let row:string[]=[],field="",quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw new Error("รูปแบบเครื่องหมายคำพูดใน CSV ไม่ถูกต้อง");quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(field);field="";closed=false;if(c!==','){if(row.some(value=>value.trim()))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}
  else {if(closed)throw new Error("รูปแบบ CSV ไม่ถูกต้อง");field+=c;}
  if(rows.length>5001)throw new Error("CSV เกิน 5,000 รายการ");
 }
 if(quoted)throw new Error("CSV มีเครื่องหมายคำพูดที่ยังไม่ปิด");
 row.push(field);if(row.some(value=>value.trim()))rows.push(row);
 const header=rows.shift()?.map(value=>value.trim().toLowerCase())??[];
 if(new Set(header).size!==header.length||header.some(key=>!key||RESERVED_KEYS.includes(key)))throw new Error("ชื่อคอลัมน์ CSV ซ้ำหรือไม่ถูกต้อง");
 const lat=header.findIndex(key=>["latitude","lat"].includes(key));const lon=header.findIndex(key=>["longitude","lon","lng"].includes(key));
 if(lat<0||lon<0)throw new Error("CSV ต้องมีคอลัมน์ latitude/lat และ longitude/lon/lng (องศา WGS84)");
 return validateData({type:"FeatureCollection",features:rows.map((values,index)=>{
  if(values.length!==header.length||!values[lat].trim()||!values[lon].trim())throw new Error(`CSV แถว ${index+2}: จำนวนคอลัมน์หรือพิกัดไม่ถูกต้อง`);
  return {type:"Feature",geometry:{type:"Point",coordinates:[Number(values[lon]),Number(values[lat])]},properties:Object.fromEntries(header.map((key,i)=>[key,values[i]]))};
 })});
}

/**
 * Google Earth and ArcGIS exports often use `xsi:schemaLocation` without declaring `xsi`; browsers reject such XML
 * outright. Declare every prefix that is used but not declared on the root element so the file parses.
 */
export function declareMissingPrefixes(text:string){
 const declared=new Set([...text.matchAll(/xmlns:([A-Za-z_][\w.-]*)\s*=/g)].map(match=>match[1]));
 // Prefixed element and attribute names only: `<p:name` or ` p:name=`, never text such as "http://".
 const used=new Set([...text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,"").matchAll(/(?:<\/?|\s)([A-Za-z_][\w.-]*):[A-Za-z_][\w.-]*(?=[\s>/=])/g)].map(match=>match[1]));
 const missing=[...used].filter(prefix=>!declared.has(prefix)&&!/^xml/i.test(prefix));
 if(!missing.length)return text;
 return text.replace(/<kml\b/,`<kml ${missing.map(prefix=>`xmlns:${prefix}="urn:x-undeclared:${prefix}"`).join(" ")}`);
}
const decodeEntities=(value:string)=>value.replace(/&(nbsp|amp|lt|gt|quot|#39|#(\d+));/g,(_,name:string,code?:string)=>code?String.fromCodePoint(Number(code)):({nbsp:" ",amp:"&",lt:"<",gt:">",quot:'"',"#39":"'"} as Record<string,string>)[name]);
const plain=(html:string)=>decodeEntities(html.replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim();
/**
 * Attributes of a Placemark: ExtendedData (Data/SimpleData), and the two-column HTML table that ArcGIS
 * and Google Earth put in `description`. The HTML is read as text, never rendered.
 */
export function kmlAttributes(place:Element,description:string){
 const properties:Record<string,string>={};
 const set=(key:string,value:string)=>{const name=key.trim().slice(0,100);if(name&&!RESERVED_KEYS.includes(name)&&!["name","description"].includes(name))properties[name]=value.slice(0,2000);};
 for(const data of Array.from(place.getElementsByTagNameNS("*","Data")))set(data.getAttribute("name")??"",data.getElementsByTagNameNS("*","value")[0]?.textContent?.trim()??"");
 for(const data of Array.from(place.getElementsByTagNameNS("*","SimpleData")))set(data.getAttribute("name")??"",data.textContent?.trim()??"");
 let table=false;
 // Cells may not span other cells or rows, so a header row next to a nested table is never read as a pair.
 const cell=String.raw`<td[^>]*>((?:(?!<\/?t[dr]\b)[\s\S])*)<\/td>`;
 for(const row of description.matchAll(new RegExp(String.raw`<tr[^>]*>\s*${cell}\s*${cell}\s*<\/tr>`,"gi"))){table=true;set(plain(row[1]),plain(row[2]));}
 // A description that only wraps the attribute table adds nothing; other HTML is kept as plain text.
 return {properties,description:table?"":/<[a-z!/]/i.test(description)?plain(description).slice(0,2000):description};
}
export function kmlData(text:string):FeatureCollection {
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error("ไม่รองรับ DTD/Entity ใน KML");
 const document=new DOMParser().parseFromString(declareMissingPrefixes(text),"application/xml");
 if(document.getElementsByTagName("parsererror").length||document.documentElement.localName!=="kml")throw new Error("ไฟล์ KML ไม่ถูกต้อง");
 const nodes=(root:Element|Document,name:string)=>Array.from(root.getElementsByTagNameNS("*",name));
 const coordinates=(element:Element)=>{
  const raw=nodes(element,"coordinates")[0]?.textContent?.trim();if(!raw)throw new Error("KML ไม่มีพิกัด");
  return raw.split(/\s+/).map(value=>{const parts=value.split(',');if(parts.some(part=>!part.trim()))throw new Error("KML มีพิกัดว่าง");return parts.map(Number);});
 };
 const features:Feature[]=[];
 for(const place of nodes(document,"Placemark")){
  const attributes=kmlAttributes(place,nodes(place,"description")[0]?.textContent??"");
  const properties={name:nodes(place,"name")[0]?.textContent?.trim()??"",...(attributes.description?{description:attributes.description}:{}),...attributes.properties};
  let found=false;
  for(const element of Array.from(place.getElementsByTagNameNS("*","*"))){
   let shape:Geometry|undefined;
   if(element.localName==="Point"){const points=coordinates(element);if(points.length!==1)throw new Error("KML Point ต้องมีพิกัดเดียว");shape={type:"Point",coordinates:points[0]};}
   if(element.localName==="LineString")shape={type:"LineString",coordinates:coordinates(element)};
   if(element.localName==="Polygon"){
    const outer=nodes(element,"outerBoundaryIs")[0];if(!outer)throw new Error("KML Polygon ไม่มีขอบนอก");
    shape={type:"Polygon",coordinates:[coordinates(outer),...nodes(element,"innerBoundaryIs").map(coordinates)]};
   }
   if(shape){found=true;features.push({type:"Feature",properties,geometry:shape});}
  }
  if(!found)throw new Error("KML รองรับเฉพาะ Point, LineString, Polygon และ MultiGeometry ที่มีชนิดเหล่านี้");
 }
 return validateData({type:"FeatureCollection",features});
}
export async function parseDataFile(file:File):Promise<FeatureCollection>{
 if(file.size>MAX_DATA_BYTES)throw new Error("ไฟล์ต้องไม่เกิน 5 MB");
 const text=(await file.text()).replace(/^\uFEFF/,"");
 const extension=file.name.split('.').pop()?.toLowerCase();
 if(extension==="csv")return csvData(text);
 if(extension==="kml")return kmlData(text);
 if(extension==="geojson"||extension==="json"){
  let input:unknown;try{input=JSON.parse(text);}catch{throw new Error("JSON ไม่ถูกต้อง");}
  if(input&&typeof input==="object"&&"type" in input&&input.type==="Feature")input={type:"FeatureCollection",features:[input]};
  return validateData(input);
 }
 throw new Error("รองรับเฉพาะ .kml, .geojson, .json และ .csv");
}
