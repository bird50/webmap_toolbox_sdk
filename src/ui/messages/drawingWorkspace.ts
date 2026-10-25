/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const drawingWorkspaceTh={
 storageLoading:"กำลังอ่าน My Drawing บนเครื่อง…",
 storedUntil:(date:string)=>`เก็บถึง ${date}`,
 storageEmpty:"ยังไม่มีรูปวาดที่บันทึกบนเครื่อง",
 storageReadFailed:"อ่านข้อมูลบนเครื่องไม่สำเร็จ กรุณาลองเปิดหน้าใหม่",
 savedUntil:(date:string)=>`บันทึกบนเครื่องแล้ว เก็บถึง ${date}`,
 saveFailed:"บันทึกไม่สำเร็จ ตรวจสอบพื้นที่และขีดจำกัด 500 วัตถุ / 20,000 จุด / 1 MB",
 unsaved:"มีการแก้ไขที่ยังไม่บันทึกบนเครื่อง",
 limit:(max:number)=>`เพิ่มได้สูงสุด ${max} วัตถุ`,
 textRequired:"กรุณากรอกข้อความก่อนวางบนแผนที่",
 draftPointsFull:"จุดครบจำนวนสูงสุด กรุณากดเสร็จสิ้น",
 strokePointsFull:"เส้นถึงจำนวนจุดสูงสุดแล้ว กรุณาปล่อยเพื่อจบเส้น",
 drawingFallback:"รูปวาด",
 legendTitle:"คำอธิบายสัญลักษณ์",
 canvas:"พื้นที่วาดบนแผนที่",
};
export type DrawingWorkspaceMessages=typeof drawingWorkspaceTh;
