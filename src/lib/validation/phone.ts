import { z } from "zod";

import { PHONE_DIGITS, formatPhone, phoneDigits } from "@/lib/format/phone";

// Apart from fields.ts because it needs the phone formatter's metadata, which
// pages without a phone field (the login) shouldn't download.

// Exactly 10 digits (area code + number; a leading 0 is dropped), stored the way
// the field shows it: "11 1234-5678".
export const phoneField = z
  .string({ error: "phoneRequired" })
  .transform(phoneDigits)
  .pipe(
    z
      .string()
      .min(1, { error: "phoneRequired" })
      .length(PHONE_DIGITS, { error: "phoneInvalid" }),
  )
  .transform(formatPhone);
