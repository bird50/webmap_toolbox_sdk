/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const drawToolTh={
 title:"Draw",
 toolbar:"Drawing Toolbar",
 layer:(title:string)=>`Layer ${title}`,
 localCount:(count:number)=>`${count} วัตถุ · บันทึกบนเครื่องได้ 15 วัน`,
 publicHint:"โหลดรูปวาดสาธารณะตามพื้นที่แผนที่",
 empty:"ยังไม่มี My Drawing",
};
export type DrawToolMessages=typeof drawToolTh;
