import { AsYouType } from "libphonenumber-js/min";

// Argentine phones: area code + number, always 10 digits, no 0 and no mobile 15.
export const PHONE_DIGITS = 10;

// Only the digits, without the leading zeros (a user may type the trunk 0).
export function phoneDigits(input: string): string {
  return input.replace(/\D/g, "").replace(/^0+/, "");
}

// What the field shows while typing and what is stored: "1112345678" becomes
// "11 1234-5678", "2211234567" "221 123-4567". An area code the formatter
// doesn't know stays as plain digits. Idempotent.
export function formatPhone(input: string): string {
  return new AsYouType("AR").input(phoneDigits(input).slice(0, PHONE_DIGITS));
}
