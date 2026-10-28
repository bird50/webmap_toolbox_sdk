/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const drawToolTh={
 title:"Draw",
 toolbar:"Drawing Toolbar",
 draft:(count:number)=>`กระดาษร่าง ${count} วัตถุ · วาดแล้วกด Save ชุดรูปวาด ด้านล่างของ Toolbar`,
 mine:"My Drawing",
 mineCount:(onMap:number,total:number)=>`(ชุดบนแผนที่ ${onMap} · ชุด ${total})`,
 mineManage:"จัดการ My Drawing",
 mineSettings:"จัดการชุดรูปวาด My Drawing",
 mineHint:"ชุดรูปวาดเก็บบนเบราว์เซอร์นี้ 15 วัน แต่ละชุดที่กด Add to map เป็น layer “My Drawing/ชื่อชุด”",
 public:"Public Drawing",
 publicCount:(n:number)=>`(ชุดบนแผนที่ ${n})`,
 publicSearch:"ค้นหาชุดรูปวาด Public",
 publicSettings:"ค้นหาชุดรูปวาด Public และ Add to map",
 publicHint:"ค้นหาชุดรูปวาดที่แชร์สาธารณะ แล้วกด Add to map ทีละชุด แต่ละชุดเป็น layer “Public Drawing/ชื่อชุด”",
};
export type DrawToolMessages=typeof drawToolTh;
