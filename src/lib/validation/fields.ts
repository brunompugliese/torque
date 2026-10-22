import { z } from "zod";

import { DNI_MAX_DIGITS } from "@/lib/format/dni";

// Reusable field rules. Error messages are keys under `validation` in
// messages/es.json; forms translate them.

// A record id, as it comes back from the database.
export const idSchema = z.uuid();

// A record picked from a list (a brand, a model): empty or not an id shows the
// field's own message.
export const requiredIdField = (errorKey: ValidationErrorKey) => z.uuid({ error: errorKey });

export const EMAIL_MAX_LENGTH = 254;

export const emailField = z
  .string({ error: "emailRequired" })
  .trim()
  .toLowerCase()
  .min(1, { error: "emailRequired" })
  .max(EMAIL_MAX_LENGTH, { error: "emailInvalid" })
  .pipe(z.email({ error: "emailInvalid" }));

// For entering an existing password (sign-in): the user types the password
// they already have, so nothing but presence is checked. Not trimmed: spaces
// can be part of a password.
export const currentPasswordField = z
  .string({ error: "passwordRequired" })
  .min(1, { error: "passwordRequired" });

export const NEW_PASSWORD_MIN_LENGTH = 12;
// Supabase Auth rejects longer passwords (bcrypt's limit).
export const NEW_PASSWORD_MAX_LENGTH = 72;

// For choosing a password (future registration or password-change forms).
// Length is the only rule (owner's decision, specs/002-login); it matches the
// Supabase dashboard policy.
export const newPasswordField = z
  .string({ error: "passwordRequired" })
  .min(1, { error: "passwordRequired" })
  .min(NEW_PASSWORD_MIN_LENGTH, { error: "passwordTooShort" })
  .max(NEW_PASSWORD_MAX_LENGTH, { error: "passwordTooLong" });

export function requiredTextField(requiredKey: ValidationErrorKey) {
  return z
    .string({ error: requiredKey })
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, { error: requiredKey }));
}

export const optionalTextField = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
  });

// Dots and spaces are ignored; what's left must be 1 to 8 digits (that's how it's stored).
export const dniField = z
  .string()
  .nullish()
  .transform((value) => (value ?? "").replace(/[.\s]/g, ""))
  .pipe(z.string().regex(/^\d*$/, { error: "dniInvalid" }).max(DNI_MAX_DIGITS, { error: "dniInvalid" }))
  .transform((value) => (value === "" ? null : value));

const emailFormat = z.email();

export const optionalEmailField = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || (value.length <= EMAIL_MAX_LENGTH && emailFormat.safeParse(value).success), {
    error: "emailInvalid",
  });

// Single-line optional text (a surname): trimmed, inner whitespace collapsed to
// one space, empty → null.
export const optionalLineField = z
  .string()
  .nullish()
  .transform((value) => {
    const collapsed = value?.trim().replace(/\s+/g, " ") ?? "";
    return collapsed === "" ? null : collapsed;
  });

export type ValidationErrorKey =
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "nameRequired"
  | "phoneRequired"
  | "phoneInvalid"
  | "dniInvalid"
  | "plateRequired"
  | "plateInvalid"
  | "yearInvalid"
  | "vinInvalid"
  | "brandRequired"
  | "brandInvalid"
  | "modelRequired"
  | "modelInvalid"
  | "clientInvalid";

// First issue per field, as the key the form translates.
export function toFieldErrors<Field extends string>(
  error: z.ZodError,
): Partial<Record<Field, ValidationErrorKey>> {
  const result: Partial<Record<Field, ValidationErrorKey>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as Field | undefined;
    if (field !== undefined && result[field] === undefined) {
      result[field] = issue.message as ValidationErrorKey;
    }
  }
  return result;
}
