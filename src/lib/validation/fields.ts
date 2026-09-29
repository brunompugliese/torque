import { z } from "zod";

// Reusable field rules. Error messages are keys under `validation` in
// messages/es.json; forms translate them.

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

export type ValidationErrorKey =
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong";

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
