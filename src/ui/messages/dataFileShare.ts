/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const dataFileShareTh={
 open:(name:string)=>`Share Public: ${name}`,
 title:"บันทึกเพื่อแชร์ Public",
 intro:"อัปโหลดข้อมูลทุกรายการในไฟล์นี้ขึ้นเซิร์ฟเวอร์ ทุกคนเห็นตำแหน่ง ชื่อ คำอธิบาย แท็ก และ properties ทั้งหมดของไฟล์ได้ ข้อมูล Public ไม่หมดอายุตามข้อมูลบนเครื่อง 15 วัน",
 name:"ชื่อชุดข้อมูล",
 namePlaceholder:"เช่น จุดวัดระดับน้ำ ตุลาคม",
 description:"รายละเอียดข้อมูล",
 descriptionPlaceholder:"แหล่งที่มา ช่วงเวลา และความหมายของคอลัมน์",
 autoTag:"แท็กอัตโนมัติ (แก้ไขไม่ได้)",
 autoTagHint:"ระบบกำหนดตามวันที่บันทึกจริง เวลาไทย",
 tags:"แท็กเพิ่มเติม (คั่นด้วย ,)",
 tagsPlaceholder:"สำรวจ, ระดับน้ำ",
 invalidFields:"ระบุชื่อชุดข้อมูล รายละเอียดไม่เกิน 1,000 ตัวอักษร และแท็กไม่เกิน 10 แท็ก แท็กละไม่เกิน 50 ตัวอักษร ห้ามกำหนดแท็ก shareYYYY-MM-DD เอง",
 tooLarge:"ข้อมูลที่จะแชร์ต้องไม่เกิน 5 MB",
 limits:(count:number)=>`แชร์ ${count.toLocaleString("th-TH")} รายการ · ไม่เกิน 5,000 รายการ / 50,000 พิกัด / 5 MB`,
 saving:"กำลังบันทึก Public…",
 save:"Save & Share Public",
 cancel:"ยกเลิก",
 failed:"แชร์ข้อมูลไม่สำเร็จ กรุณาลองใหม่",
 shared:(count:number,tags:string)=>`บันทึก Public แล้ว ${count.toLocaleString("th-TH")} รายการ · ${tags} เปิด Layer Public Data Files เพื่อดู`,
};
export type DataFileShareMessages=typeof dataFileShareTh;
