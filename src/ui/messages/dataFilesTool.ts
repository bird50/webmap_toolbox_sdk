/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const dataFilesToolTh={
 title:"Simple Data Files",
 layer:(count:number)=>`Layer My Data Files (${count})`,
 settings:"จัดการ My Data Files",
 note:"KML · GeoJSON · CSV เก็บเฉพาะเบราว์เซอร์นี้ 15 วัน แชร์ Public ได้จากหน้าจัดการไฟล์",
 publicLayer:"Layer Public Data Files",
 publicSettings:"ตั้งค่า Public Data Files",
 publicHint:"ชุดข้อมูลที่ผู้ใช้แชร์ไว้ในพื้นที่แผนที่ปัจจุบัน",
 filterCount:(count:number)=>` · ใช้เงื่อนไขค้นหา ${count} ข้อ`,
};
export type DataFilesToolMessages=typeof dataFilesToolTh;
