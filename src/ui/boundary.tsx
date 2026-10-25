"use client";
import {Component,type ReactNode} from "react";

/** Isolates one tool's render errors so the other tools and the map keep working. */
export class ToolBoundary extends Component<{children:ReactNode;message:string},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p role="alert" className="rounded-lg border p-3 text-xs text-[color:var(--sdk-warning,#b45309)]">{this.props.message}</p>:this.props.children;}
}
