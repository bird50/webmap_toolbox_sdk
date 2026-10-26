/** Thai defaults for the provider and ToolboxPanel. Hosts override them at the top level of `messages` (e.g. `{noTools:"…"}`). */
export const runtimeTh={
 noTools:"ไม่มีเครื่องมือที่รองรับพื้นที่ปฏิบัติงานนี้",
 toolFailed:(title:string)=>`เปิดเครื่องมือ ${title} ไม่สำเร็จ กรุณาโหลดหน้าใหม่`,
 layersFailed:(title:string)=>`เพิ่มชั้นข้อมูลของเครื่องมือ ${title} ไม่สำเร็จ เนื่องจากรหัสชั้นข้อมูลซ้ำหรือไม่ถูกต้อง`,
};
export type RuntimeMessages=typeof runtimeTh;
