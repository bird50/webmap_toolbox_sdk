/** Thai defaults for this component's user-facing text. Functions take the values they interpolate. */
export const photoOverlayTh={
 view:(name:string)=>`ดูภาพ ${name}`,
 close:"ปิด",
 storedUntil:(date:string)=>`เก็บบนเครื่องถึง ${date}`,
 sharedBy:(name:string)=>`แชร์โดย ${name}`,
 capturedAt:(date:string)=>`ถ่ายเมื่อ ${date}`,
 cameraTime:"(เวลาตามกล้อง)",
 viewSet:"ดูชุดภาพ Public",
};
export type PhotoOverlayMessages=typeof photoOverlayTh;
