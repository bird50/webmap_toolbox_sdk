/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const photoPluginTh={
 expired:(n:number)=>`ลบภาพที่ครบกำหนด 15 วันแล้ว ${n} รูป`,
 storageUnavailable:"ไม่สามารถเปิดที่เก็บรูปบนเครื่องได้ กรุณาอนุญาตการจัดเก็บข้อมูลเว็บไซต์แล้วเปิดหน้าใหม่",
};
export type PhotoPluginMessages=typeof photoPluginTh;
