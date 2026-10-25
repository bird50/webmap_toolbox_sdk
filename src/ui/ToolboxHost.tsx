"use client";
import {Component,type ReactNode} from "react";
import {toolboxAvailable,type ToolboxDefinition,type WebmapHost} from "./contracts.js";

class ToolBoundary extends Component<{children:ReactNode;title:string},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p role="alert" className="rounded-lg border p-3 text-xs text-amber-700">เปิดเครื่องมือ {this.props.title} ไม่สำเร็จ กรุณาโหลดหน้าใหม่</p>:this.props.children;}
}
/** Mount/unmount panels normally; hooks in each panel own their cleanup. */
export function ToolboxHost<S>({tools,host,services}:{tools:readonly ToolboxDefinition<S>[];host:WebmapHost;services:S}) {
  const available=tools.filter(tool=>toolboxAvailable(tool,host));
  return available.length?available.map(({id,title,Panel})=><ToolBoundary key={id} title={title}><Panel host={host} services={services}/></ToolBoundary>):<p role="status" className="text-xs text-slate-500">ไม่มีเครื่องมือที่รองรับพื้นที่ปฏิบัติงานนี้</p>;
}
