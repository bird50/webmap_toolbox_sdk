/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const layerPanelTh={
 title:"Layer",
 opacity:(title:string)=>`ความทึบ ${title}`,
 moveUp:(title:string)=>`เลื่อน ${title} ขึ้น`,
 layerPanel:"Layer Panel",
 mapPanel:"Map Panel",
 toolboxPanel:"Toolbox Panel",
};
export type LayerPanelMessages=typeof layerPanelTh;
