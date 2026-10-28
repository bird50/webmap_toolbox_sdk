/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const navigationTh={
 title:"มุมมองแผนที่",
 homeLabel:"แสดงประเทศไทย",
 panel:"เครื่องมือมุมมอง",
 visibleLayers:(count:number)=>`เปิดอยู่ ${count} ชั้นข้อมูล`,
};
export type NavigationMessages=typeof navigationTh;
