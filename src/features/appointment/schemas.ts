import { z } from "zod";

import { isIsoDate } from "@/lib/format/date";
import { isTime, normalizeTime } from "@/lib/format/time";
import { APPOINTMENT_STATUSES } from "@/lib/status";
import { idSchema, optionalTextField, requiredIdField, type ValidationErrorKey } from "@/lib/validation/fields";

// An appointment with its vehicle, client and latest job (appointment_list). Rows are parsed at
// runtime until database types are generated.
export const APPOINTMENT_LIST_COLUMNS =
  "id, vehicle_id, client_id, date, time, reason, status, enabled, created_at, " +
  "plate, vehicle_year, brand_name, model_name, vehicle_enabled, " +
  "client_name, client_surname, client_phone_number, client_enabled, job_id";

export const appointmentListRowSchema = z
  .object({
    id: z.string(),
    vehicle_id: z.string(),
    client_id: z.string().nullable(),
    date: z.string(),
    time: z.string(),
    reason: z.string().nullable(),
    status: z.enum(APPOINTMENT_STATUSES),
    enabled: z.boolean(),
    created_at: z.string(),
    plate: z.string(),
    vehicle_year: z.number().nullable(),
    brand_name: z.string(),
    model_name: z.string(),
    vehicle_enabled: z.boolean(),
    client_name: z.string().nullable(),
    client_surname: z.string().nullable(),
    client_phone_number: z.string().nullable(),
    client_enabled: z.boolean().nullable(),
    job_id: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    date: row.date,
    // "09:00:00" → "09:00"
    time: normalizeTime(row.time),
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    vehicle: {
      id: row.vehicle_id,
      plate: row.plate,
      year: row.vehicle_year,
      brandName: row.brand_name,
      modelName: row.model_name,
      enabled: row.vehicle_enabled,
    },
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
    jobId: row.job_id,
  }));

export type AppointmentListItem = z.output<typeof appointmentListRowSchema>;

export const appointmentIdSchema = idSchema;

// -----------------------------------------------------------------------------
// The appointment form. Used by the form and by the actions.
// -----------------------------------------------------------------------------

export const appointmentFormSchema = z.object({
  vehicleId: requiredIdField("vehicleRequired"),
  date: z
    .string({ error: "dateRequired" })
    .refine((value) => isIsoDate(value), { error: "dateRequired" }),
  // Any hour and minute: no steps and no hours the shop keeps (docs/design.md: Time is 24 h).
  time: z.string({ error: "timeRequired" }).refine((value) => isTime(value), { error: "timeRequired" }),
  // New appointments are always Pendiente: only an edit sends another status.
  status: z.enum(APPOINTMENT_STATUSES).default("pendiente"),
  reason: optionalTextField,
});

export type AppointmentFormInput = z.input<typeof appointmentFormSchema>;
export type AppointmentFormValues = z.output<typeof appointmentFormSchema>;

// First issue per field, keyed by its name: "vehicleId", "date", "time".
export function toAppointmentFieldErrors(error: z.ZodError): Record<string, ValidationErrorKey> {
  const result: Record<string, ValidationErrorKey> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field !== "" && result[field] === undefined) result[field] = issue.message as ValidationErrorKey;
  }
  return result;
}
