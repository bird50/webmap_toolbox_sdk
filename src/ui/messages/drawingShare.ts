/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const drawingShareTh={
 section:"บันทึกและแชร์รูปวาด",
 save:"บันทึก My Drawing",
 invalid:"ระบุชื่อ และเลือก 1–100 วัตถุ รวมไม่เกิน 20,000 จุด พิกัดต้องอยู่ใน WGS84",
 tooLarge:"ข้อมูลเกิน 1 MB กรุณาเลือกวัตถุน้อยลง",
 shareFailed:"แชร์ไม่สำเร็จ",
 shared:(count:number)=>`แชร์ Public แล้ว ${count} วัตถุ เปิด Layer Public Drawing เพื่อดู`,
 name:"ชื่อชุดรูปวาด Public",
 scopeSelected:"แชร์เฉพาะวัตถุที่เลือก",
 scopeAll:"แชร์ทุกวัตถุใน My Drawing",
 notice:" · ทุกคนจะเห็นรูปวาด ข้อความ และพิกัด การแก้ไขบนเครื่องไม่เปลี่ยนสำเนา Public",
 busy:"กำลังดำเนินการ…",
 submit:"Save & Share Public",
};
export type DrawingShareMessages=typeof drawingShareTh;
