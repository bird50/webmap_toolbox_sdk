/** Runtime UI text. Hosts override any subset through `ToolboxProvider messages`; tool-specific text follows in later releases. */
export type ToolboxMessages={
 noTools:string;
 toolFailed:(title:string)=>string;
 layersFailed:(title:string)=>string;
};
export const thMessages:ToolboxMessages={
 noTools:'ไม่มีเครื่องมือที่รองรับพื้นที่ปฏิบัติงานนี้',
 toolFailed:title=>`เปิดเครื่องมือ ${title} ไม่สำเร็จ กรุณาโหลดหน้าใหม่`,
 layersFailed:title=>`เพิ่มชั้นข้อมูลของเครื่องมือ ${title} ไม่สำเร็จ เนื่องจากรหัสชั้นข้อมูลซ้ำหรือไม่ถูกต้อง`,
};
