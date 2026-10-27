/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const photoToolTh={
 title:"Photo",
 myLayer:"My Photos",
 myCount:(events:number,photos:number)=>`(ชุดบนแผนที่ ${events} · รูป ${photos})`,
 myManage:"จัดการ My Photos",
 mySettings:"จัดการ My Photos และชุดเหตุการณ์",
 myHint:"เก็บรูปบนเบราว์เซอร์นี้ 15 วันนับจากวันที่เพิ่ม แต่ละชุดที่กด Add to map เป็น layer “My Photos/ชื่อเหตุการณ์” ในรายการชั้นข้อมูล ไม่อัปโหลดจนกว่าจะกด Save to Public",
 publicLayer:"Layer Public Photos",
 publicSettings:"ตั้งค่า Public Photos",
 publicHint:"ภาพที่แชร์สาธารณะในพื้นที่แผนที่ปัจจุบัน",
 filterCount:(n:number)=>` · ใช้เงื่อนไขค้นหา ${n} รายการ`,
 publicLoading:"กำลังโหลด Public Photos…",
 publicMore:"มีภาพเพิ่มเติม กรุณาซูมเข้าเพื่อดูครบ",
 publicEmpty:"ไม่พบภาพ Public ในพื้นที่นี้",
};
export type PhotoToolMessages=typeof photoToolTh;
