import { z } from "zod";

import {
  dniField,
  optionalEmailField,
  optionalLineField,
  phoneField,
  requiredTextField,
} from "@/lib/validation/fields";

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

export const CLIENT_SORT_COLUMNS = {
  cliente: "name_key",
  dni: "dni_number",
  telefono: "phone_key",
  email: "email_key",
  creado: "created_at",
} as const;
export const CLIENT_DEFAULT_SORT = "cliente";

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

export const clientIdSchema = z.uuid();
