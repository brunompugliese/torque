import { z } from "zod";

import { JOB_STATUSES, jobPhase } from "@/lib/status";
import { idSchema, optionalTextField, requiredIdField, type ValidationErrorKey } from "@/lib/validation/fields";
import { kilometersField, quantityField } from "@/lib/validation/job-fields";
import { moneyField, parseMoney } from "@/lib/validation/money-fields";

// A job with the names of its services (job and service hold no encrypted
// column, so they are read from the tables). Rows are parsed at runtime until
// database types are generated.
export const JOB_HISTORY_COLUMNS =
  "id, status, kilometers, quoted_total, final_total, enabled, created_at, job_item(created_at, service(name))";

// numeric columns can arrive as numbers or strings.
const amount = z.union([z.number(), z.string().transform(Number)]).nullable();

export const jobRowSchema = z
  .object({
    id: z.string(),
    status: z.enum(JOB_STATUSES),
    kilometers: z.number().nullable(),
    quoted_total: amount,
    final_total: amount,
    enabled: z.boolean(),
    created_at: z.string(),
    job_item: z.array(z.object({ created_at: z.string(), service: z.object({ name: z.string() }).nullable() })),
  })
  .transform(({ quoted_total, final_total, created_at, job_item, ...row }) => ({
    ...row,
    quotedTotal: quoted_total,
    finalTotal: final_total,
    createdAt: created_at,
    // In the order the services were added to the job.
    services: [...job_item]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .flatMap((item) => (item.service ? [item.service.name] : [])),
  }));

export type VehicleJob = z.output<typeof jobRowSchema>;

// -----------------------------------------------------------------------------
// The jobs page: a job with its vehicle, client and appointment (job_list).
// -----------------------------------------------------------------------------

export const JOB_LIST_COLUMNS =
  "id, number, vehicle_id, client_id, appointment_id, status, observations, kilometers, quoted_total, final_total, " +
  "enabled, created_at, updated_at, plate, vehicle_year, brand_name, model_name, vehicle_enabled, " +
  "client_name, client_surname, client_phone_number, client_enabled, " +
  "appointment_date, appointment_time, appointment_enabled";

export const jobListRowSchema = z
  .object({
    id: z.string(),
    number: z.number(),
    vehicle_id: z.string(),
    client_id: z.string().nullable(),
    appointment_id: z.string().nullable(),
    status: z.enum(JOB_STATUSES),
    observations: z.string().nullable(),
    kilometers: z.number().nullable(),
    quoted_total: amount,
    final_total: amount,
    enabled: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    plate: z.string(),
    vehicle_year: z.number().nullable(),
    brand_name: z.string(),
    model_name: z.string(),
    vehicle_enabled: z.boolean(),
    client_name: z.string().nullable(),
    client_surname: z.string().nullable(),
    client_phone_number: z.string().nullable(),
    client_enabled: z.boolean().nullable(),
    appointment_date: z.string().nullable(),
    appointment_time: z.string().nullable(),
    appointment_enabled: z.boolean().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    observations: row.observations,
    kilometers: row.kilometers,
    quotedTotal: row.quoted_total,
    finalTotal: row.final_total,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    appointment:
      row.appointment_id !== null && row.appointment_date !== null && row.appointment_time !== null
        ? {
            id: row.appointment_id,
            date: row.appointment_date,
            // "09:00:00" → "09:00"
            time: row.appointment_time.slice(0, 5),
            enabled: row.appointment_enabled ?? true,
          }
        : null,
  }));

export type JobListItem = z.output<typeof jobListRowSchema>;

// The services of one job, in the order they were added.
export const JOB_ITEM_COLUMNS =
  "id, service_id, quantity, quoted_unit_price, final_unit_price, created_at, service(name, enabled)";

export const jobItemRowSchema = z
  .object({
    id: z.string(),
    service_id: z.string(),
    quantity: z.union([z.number(), z.string().transform(Number)]),
    quoted_unit_price: z.union([z.number(), z.string().transform(Number)]),
    final_unit_price: amount,
    created_at: z.string(),
    service: z.object({ name: z.string(), enabled: z.boolean() }).nullable(),
  })
  .transform((row) => ({
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service?.name ?? "",
    serviceEnabled: row.service?.enabled ?? true,
    quantity: row.quantity,
    quotedUnitPrice: row.quoted_unit_price,
    finalUnitPrice: row.final_unit_price,
    createdAt: row.created_at,
  }));

export type JobItem = z.output<typeof jobItemRowSchema>;

// Every status change of one job. The user's name comes from the profile.
export const JOB_HISTORY_ENTRY_COLUMNS = "id, old_status, new_status, changed_at, profile(full_name)";

export const jobHistoryEntrySchema = z
  .object({
    id: z.string(),
    old_status: z.enum(JOB_STATUSES).nullable(),
    new_status: z.enum(JOB_STATUSES),
    changed_at: z.string(),
    profile: z.object({ full_name: z.string() }).nullable(),
  })
  .transform((row) => ({
    id: row.id,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    changedAt: row.changed_at,
    changedBy: row.profile?.full_name ?? null,
  }));

export type JobHistoryEntry = z.output<typeof jobHistoryEntrySchema>;

export const jobIdSchema = idSchema;

// -----------------------------------------------------------------------------
// The job form. Used by the form and by the actions.
// -----------------------------------------------------------------------------

const optionalIdField = z
  .union([idSchema, z.literal("")])
  .nullish()
  .transform((value) => value || null);

// A final price: empty → none; otherwise a price. Whether it is required depends
// on the job's phase, so the job schema checks that.
const finalPriceField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value, context) => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (text === "") return null;
    const price = typeof value === "number" ? value : parseMoney(text);
    if (price === null) {
      context.addIssue({ code: "custom", message: "priceInvalid" });
      return z.NEVER;
    }
    return price;
  });

// One service row of the catalog. `id` is the saved item being edited; rows without it are new.
export const jobItemFormSchema = z
  .object({
    id: optionalIdField,
    serviceId: optionalIdField,
    quantity: quantityField,
    quotedUnitPrice: moneyField,
    finalUnitPrice: finalPriceField,
  })
  // `when` keeps this check running even if another field of the row is invalid, so a
  // row without a service and without a price shows both errors.
  .refine((item) => Boolean(item?.serviceId), {
    path: ["serviceId"],
    error: "serviceRequired",
    when: () => true,
  });

export type JobItemFormInput = z.input<typeof jobItemFormSchema>;
export type JobItemFormValues = z.output<typeof jobItemFormSchema>;

export const jobFormSchema = z
  .object({
    vehicleId: requiredIdField("vehicleRequired"),
    clientId: optionalIdField,
    status: z.enum(JOB_STATUSES).default("pendiente"),
    kilometers: kilometersField,
    appointmentId: optionalIdField,
    observations: optionalTextField,
    items: z.array(jobItemFormSchema).default([]),
  })
  .superRefine((job, context) => {
    // In the work phase every service has a final price.
    if (jobPhase(job.status, false) === "work") {
      job.items.forEach((item, index) => {
        if (item.finalUnitPrice === null) {
          context.addIssue({ code: "custom", path: ["items", index, "finalUnitPrice"], message: "priceRequired" });
        }
      });
    }
  });

export type JobFormInput = z.input<typeof jobFormSchema>;
export type JobFormValues = z.output<typeof jobFormSchema>;

// First issue per field, keyed by its path: "vehicleId", "items.0.serviceId",
// "items.1.newService.name", "newClient.dni".
export function toJobFieldErrors(error: z.ZodError): Record<string, ValidationErrorKey> {
  const result: Record<string, ValidationErrorKey> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field !== "" && result[field] === undefined) result[field] = issue.message as ValidationErrorKey;
  }
  return result;
}
