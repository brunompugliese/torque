// Argentina: mobile numbers go after 549 (country code 54 + the mobile 9).
// First version of the rule; adjust here if real numbers need more.
const ARGENTINA_MOBILE_PREFIX = "549";
const ARGENTINA_CODE = "54";

export function toWhatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  const number = digits.startsWith(ARGENTINA_CODE) ? digits : `${ARGENTINA_MOBILE_PREFIX}${digits}`;
  return `https://wa.me/${number}`;
}
