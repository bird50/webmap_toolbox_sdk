/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const drawingSetControlsTh={
 section:"บันทึกชุดรูปวาด",
 name:"ชื่อชุดรูปวาด",
 namePlaceholder:"เช่น แนวคันกั้นน้ำ",
 nameRequired:"กรุณาระบุชื่อชุดรูปวาด",
 tags:"แท็ก (คั่นด้วย ,)",
 tagsPlaceholder:"น้ำท่วม, เฝ้าระวัง",
 invalidTags:"แท็กไม่เกิน 10 แท็ก แท็กละไม่เกิน 50 ตัวอักษร ห้ามกำหนดแท็ก shareYYYY-MM-DD เอง",
 empty:"วาดอย่างน้อย 1 วัตถุก่อนบันทึกชุด",
 save:"Save ชุดรูปวาด",
 saved:(name:string)=>`บันทึกชุด "${name}" บนเครื่องและเพิ่มเป็น layer “My Drawing/${name}” แล้ว จัดการชุดได้ที่ My Drawing ในแผง Toolbox`,
 saveEdit:"บันทึกการแก้ไข",
 edited:(name:string)=>`บันทึกการแก้ไขชุด "${name}" แล้ว`,
 cancel:"ยกเลิก",
 busy:"กำลังบันทึก…",
 failed:"บันทึกไม่สำเร็จ ตรวจสอบพื้นที่และขีดจำกัด 500 วัตถุ / 20,000 จุด / 1 MB",
};
export type DrawingSetControlsMessages=typeof drawingSetControlsTh;
