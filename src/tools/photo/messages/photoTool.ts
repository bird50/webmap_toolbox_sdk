/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const photoToolTh={
 title:"Photo",
 myLayer:"My Photos",
 myCount:(events:number,photos:number)=>`(ชุดบนแผนที่ ${events} · รูป ${photos})`,
 myManage:"จัดการ My Photos",
 mySettings:"จัดการ My Photos และชุดเหตุการณ์",
 myHint:"เก็บรูปบนเบราว์เซอร์นี้ 15 วันนับจากวันที่เพิ่ม แต่ละชุดที่กด Add to map เป็น layer “My Photos/ชื่อเหตุการณ์” ในรายการชั้นข้อมูล ไม่อัปโหลดจนกว่าจะกด Save to Public",
 publicLayer:"Public Photos",
 publicCount:(n:number)=>`(ชุดบนแผนที่ ${n})`,
 publicSearch:"ค้นหาชุดรูปภาพ Public",
 publicSettings:"ค้นหาชุดรูปภาพ Public และ Add to map",
 publicHint:"ค้นหาชุดรูปภาพที่แชร์สาธารณะ แล้วกด Add to map ทีละชุด แต่ละชุดเป็น layer “Public Photos/ชื่อชุด” ในรายการชั้นข้อมูล",
};
export type PhotoToolMessages=typeof photoToolTh;
