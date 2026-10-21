import { z } from "zod";

import { idSchema } from "@/lib/validation/fields";

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

export const clientIdSchema = idSchema;

// The same vehicle twice counts once.
export const vehicleIdsSchema = z
  .array(idSchema)
  .min(1)
  .transform((ids) => [...new Set(ids)]);
