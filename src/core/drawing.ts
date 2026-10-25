import {circle,distance} from "@turf/turf";

export type DrawTool="select"|"pan"|"pen"|"highlighter"|"eraser"|"point"|"line"|"polygon"|"rectangle"|"circle"|"arrow"|"text"|"textbox"|"callout"|"label"|"sticky"|"number"|"legend";
export type Coordinate=[number,number];
export type DrawingStyle={color:string;background:string;border:string;font:string;fontSize:number;width:number;opacity:number;rotation:number;alignment:"left"|"center"|"right"};
export type Drawing={id:string;tool:DrawTool;points:Coordinate[];text:string;style:DrawingStyle;boxWidth:number;boxHeight:number};
export const defaultDrawingStyle:DrawingStyle={color:"#dc2626",background:"#ffffff",border:"#64748b",font:"sans-serif",fontSize:18,width:3,opacity:1,rotation:0,alignment:"left"};
export const textTools:DrawTool[]=["text","textbox","callout","label","sticky","number","legend"];
export const dragTools:DrawTool[]=["pen","highlighter","rectangle","circle","arrow","callout"];
export const MAX_DRAWINGS=500;
export const MAX_DRAWING_POINTS=2000;

/** WGS84 geometry; circles use geodesic distance rather than screen pixels. */
export function shapePoints(tool:DrawTool,start:Coordinate,end:Coordinate):Coordinate[] {
  if(tool==="rectangle")return [start,[end[0],start[1]],end,[start[0],end[1]],start];
  if(tool==="circle") {
    const radius=distance(start,end);
    if(radius===0)return [start];
    return circle(start,radius,{steps:64}).geometry.coordinates[0] as Coordinate[];
  }
  return [start,end];
}

export function screenBounds(points:Coordinate[]) {
  return {left:Math.min(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))};
}

export function transformPoints(points:Coordinate[],start:Coordinate,end:Coordinate,resize:boolean):Coordinate[] {
  const bounds=screenBounds(points);
  const dx=end[0]-start[0],dy=end[1]-start[1];
  if(!resize)return points.map(([x,y])=>[x+dx,y+dy]);
  const width=Math.max(1,bounds.right-bounds.left),height=Math.max(1,bounds.bottom-bounds.top);
  const sx=Math.max(.05,(width+dx)/width),sy=Math.max(.05,(height+dy)/height);
  return points.map(([x,y])=>[bounds.left+(x-bounds.left)*sx,bounds.top+(y-bounds.top)*sy]);
}
