import { z } from "zod";

import { clientFormSchema } from "@/features/client/schemas";
import { idSchema, requiredIdField, type ValidationErrorKey } from "@/lib/validation/fields";
import { plateField, vinField, yearField } from "@/lib/validation/vehicle-fields";

// Read through vehicle_decrypted (the table holds ciphertext). Rows are parsed
// at runtime until database types are generated.
export const VEHICLE_COLUMNS = "id, plate, brand_name, model_name, year, vin, enabled";

export const vehicleRowSchema = z
  .object({
    id: z.string(),
    plate: z.string(),
    brand_name: z.string(),
    model_name: z.string(),
    year: z.number().nullable(),
    vin: z.string().nullable(),
    enabled: z.boolean(),
  })
  .transform(({ brand_name, model_name, ...row }) => ({ ...row, brandName: brand_name, modelName: model_name }));

export type Vehicle = z.output<typeof vehicleRowSchema>;

// What the vehicles page lists and its modal shows: the vehicle with its client
// and last km, all computed by the view.
export const VEHICLE_LIST_COLUMNS =
  "id, plate, brand_id, model_id, brand_name, model_name, year, vin, enabled, created_at, " +
  "client_id, client_name, client_surname, client_phone_number, client_enabled, last_km";

export const vehicleListRowSchema = z
  .object({
    id: z.string(),
    plate: z.string(),
    brand_id: z.string(),
    model_id: z.string(),
    brand_name: z.string(),
    model_name: z.string(),
    year: z.number().nullable(),
    vin: z.string().nullable(),
    enabled: z.boolean(),
    created_at: z.string(),
    client_id: z.string().nullable(),
    client_name: z.string().nullable(),
    client_surname: z.string().nullable(),
    client_phone_number: z.string().nullable(),
    client_enabled: z.boolean().nullable(),
    last_km: z.number().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    plate: row.plate,
    brandId: row.brand_id,
    modelId: row.model_id,
    brandName: row.brand_name,
    modelName: row.model_name,
    year: row.year,
    vin: row.vin,
    enabled: row.enabled,
    createdAt: row.created_at,
    lastKm: row.last_km,
    client:
      row.client_id !== null && row.client_name !== null
        ? {
            id: row.client_id,
            name: row.client_name,
            surname: row.client_surname,
            phoneNumber: row.client_phone_number ?? "",
            enabled: row.client_enabled ?? true,
          }
        : null,
  }));

export type VehicleListItem = z.output<typeof vehicleListRowSchema>;
export type VehicleClient = NonNullable<VehicleListItem["client"]>;

export const clientIdSchema = idSchema;

// The same vehicle twice counts once.
export const vehicleIdsSchema = z
  .array(idSchema)
  .min(1)
  .transform((ids) => [...new Set(ids)]);

export const vehicleIdSchema = idSchema;

// The owner created on the spot: the client form's fields without the email.
export const newClientSchema = clientFormSchema.pick({ name: true, surname: true, phoneNumber: true, dni: true });

export type NewClientInput = z.input<typeof newClientSchema>;

const optionalIdField = z
  .union([idSchema, z.literal("")])
  .nullish()
  .transform((value) => value || null);

// Used by the form and by the actions. The owner is either an existing client
// (`clientId`) or one created with the vehicle (`newClient`), never both.
export const vehicleFormSchema = z
  .object({
    plate: plateField,
    year: yearField,
    brandId: requiredIdField("brandRequired"),
    modelId: requiredIdField("modelRequired"),
    vin: vinField,
    clientId: optionalIdField,
    newClient: newClientSchema.nullish().transform((value) => value ?? null),
  })
  .refine((values) => !(values.clientId && values.newClient), { path: ["newClient"], error: "invalid" });

export type VehicleFormInput = z.input<typeof vehicleFormSchema>;
export type VehicleFormValues = z.output<typeof vehicleFormSchema>;

export type NewClientField = `newClient.${keyof z.output<typeof newClientSchema>}`;
export type VehicleField = Exclude<keyof VehicleFormValues, "newClient"> | "newClient" | NewClientField;

// First issue per field, with the owner's fields as "newClient.<field>".
export function toVehicleFieldErrors(error: z.ZodError): Partial<Record<VehicleField, ValidationErrorKey>> {
  const result: Partial<Record<VehicleField, ValidationErrorKey>> = {};
  for (const issue of error.issues) {
    const [head, nested] = issue.path;
    if (typeof head !== "string") continue;
    const field = (head === "newClient" && typeof nested === "string" ? `newClient.${nested}` : head) as VehicleField;
    if (result[field] === undefined) result[field] = issue.message as ValidationErrorKey;
  }
  return result;
}

// A brand or model in a dropdown.
export const catalogOptionSchema = z.object({ id: z.string(), name: z.string() });

export type CatalogOption = z.output<typeof catalogOptionSchema>;
