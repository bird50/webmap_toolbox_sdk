/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const publicDrawingsTh={
 zoomIn:"ซูมเพื่อดู Public Drawing",
 loading:"กำลังโหลด Public Drawing…",
 hasMore:"มีรูปวาดเพิ่มเติม กรุณาซูมเข้า",
 count:(count:number)=>`${count} วัตถุ Public ในพื้นที่นี้`,
 failed:"โหลด Public Drawing ไม่สำเร็จ ลองปิด–เปิด Layer อีกครั้ง",
};
export type PublicDrawingsMessages=typeof publicDrawingsTh;
