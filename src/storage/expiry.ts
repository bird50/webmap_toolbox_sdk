/** Expiry timestamps shown to users, in Thai date/time for the Bangkok time zone. */
export function formatExpiry(timestamp:number){
 return new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"}).format(timestamp);
}
