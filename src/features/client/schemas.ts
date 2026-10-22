import { z } from "zod";

import {
  dniField,
  idSchema,
  optionalEmailField,
  optionalLineField,
  requiredTextField,
} from "@/lib/validation/fields";
import { phoneField } from "@/lib/validation/phone";

export const clientFormSchema = z.object({
  name: requiredTextField("nameRequired"),
  surname: optionalLineField,
  phoneNumber: phoneField,
  dni: dniField,
  email: optionalEmailField,
});

export type ClientFormInput = z.input<typeof clientFormSchema>;
export type ClientFormValues = z.output<typeof clientFormSchema>;
export type ClientField = keyof ClientFormValues;

// Read through client_decrypted (the table holds ciphertext). Rows are parsed
// at runtime until database types are generated.
export const CLIENT_COLUMNS = "id, name, surname, dni, phone_number, email, enabled, created_at";

export const clientRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    surname: z.string().nullable(),
    dni: z.string().nullable(),
    phone_number: z.string(),
    email: z.string().nullable(),
    enabled: z.boolean(),
    created_at: z.string(),
  })
  .transform(({ phone_number, created_at, ...row }) => ({ ...row, phoneNumber: phone_number, createdAt: created_at }));

export type Client = z.output<typeof clientRowSchema>;

export const clientIdSchema = idSchema;

// A client in a dropdown (the vehicle form's owner): just what tells clients apart.
export const CLIENT_OPTION_COLUMNS = "id, name, surname, phone_number, enabled";

export const clientOptionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    surname: z.string().nullable(),
    phone_number: z.string(),
    enabled: z.boolean(),
  })
  .transform(({ phone_number, ...row }) => ({ ...row, phoneNumber: phone_number }));

export type ClientOption = z.output<typeof clientOptionSchema>;
