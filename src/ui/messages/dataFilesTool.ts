/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const dataFilesToolTh={
 title:"Simple Data Files",
 mine:"My Data Files",
 mineCount:(onMap:number,total:number)=>`(ชุดบนแผนที่ ${onMap} · ชุด ${total})`,
 mineManage:"จัดการ My Data Files",
 settings:"จัดการชุดข้อมูล My Data Files",
 mineHint:"KML · GeoJSON · CSV เก็บบนเบราว์เซอร์นี้ 15 วัน แต่ละชุดที่กด Add to map เป็น layer “My Data Files/ชื่อชุด”",
 public:"Public Data Files",
 publicCount:(n:number)=>`(ชุดบนแผนที่ ${n})`,
 publicSearch:"ค้นหาชุดข้อมูล Public",
 publicSettings:"ค้นหาชุดข้อมูล Public และ Add to map",
 publicHint:"ค้นหาชุดข้อมูลที่แชร์สาธารณะ แล้วกด Add to map ทีละชุด แต่ละชุดเป็น layer “Public Data Files/ชื่อชุด”",
};
export type DataFilesToolMessages=typeof dataFilesToolTh;
