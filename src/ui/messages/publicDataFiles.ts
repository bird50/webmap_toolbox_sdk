/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const publicDataFilesTh={
 zoomIn:"ซูมเพื่อดู Public Data Files",
 loading:"กำลังโหลด Public Data Files…",
 hasMore:"มีข้อมูลเพิ่มเติม กรุณาซูมเข้า",
 count:(count:number)=>`${count.toLocaleString("th-TH")} รายการ Public ในพื้นที่นี้`,
 empty:"ไม่มีข้อมูล Public ในพื้นที่นี้",
 failed:"โหลด Public Data Files ไม่สำเร็จ ลองปิด–เปิด Layer อีกครั้ง",
 title:"ตั้งค่า Public Data Files",
 description:"ค้นหาชุดข้อมูลสาธารณะในพื้นที่แผนที่ปัจจุบัน",
 close:"ปิดการตั้งค่า Public Data Files",
 invalid:"กรุณาตรวจสอบเงื่อนไขค้นหา",
 search:"คำค้น",
 searchPlaceholder:"ชื่อชุดข้อมูล รายละเอียด หรือผู้แชร์",
 tag:"Tag",
 tagPlaceholder:"เช่น สำรวจ หรือ share2026-10-26",
 tagHint:"ตรงกับแท็กทั้งคำ ไม่ต้องใส่ #",
 hint:"ใส่ทั้งสองช่องจะค้นหาข้อมูลที่ตรงทั้งสองเงื่อนไข",
 clear:"ล้างเงื่อนไข",
 apply:"ค้นหาข้อมูล",
};
export type PublicDataFilesMessages=typeof publicDataFilesTh;
