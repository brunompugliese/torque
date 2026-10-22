import { z } from "zod";

import { JOB_STATUSES } from "@/lib/status";

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
