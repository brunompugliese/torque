import { z } from "zod";

import { optionalTextField, requiredTextField } from "@/lib/validation/fields";

export const serviceFormSchema = z.object({
  name: requiredTextField("nameRequired"),
  description: optionalTextField,
});

export type ServiceFormInput = z.input<typeof serviceFormSchema>;
export type ServiceFormValues = z.output<typeof serviceFormSchema>;
export type ServiceField = keyof ServiceFormValues;

export const SERVICE_SORT_COLUMNS = { nombre: "name_key", creado: "created_at" } as const;
export const SERVICE_DEFAULT_SORT = "nombre";

// Rows are parsed at runtime until database types are generated.
export const SERVICE_COLUMNS = "id, name, description, enabled, created_at";

export const serviceRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    created_at: z.string(),
  })
  .transform(({ created_at, ...row }) => ({ ...row, createdAt: created_at }));

export type Service = z.output<typeof serviceRowSchema>;

export const serviceIdSchema = z.uuid();
