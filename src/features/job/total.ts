import type { VehicleJob } from "./schemas";

export type JobTotal = { amount: number; kind: "final" | "quoted" };

// Lists show the final total, labelled "Final", when the job has one, otherwise
// the quoted one, labelled "Presupuestado" (docs/design.md#prices).
export function jobTotal(job: Pick<VehicleJob, "finalTotal" | "quotedTotal">): JobTotal | null {
  if (job.finalTotal !== null) return { amount: job.finalTotal, kind: "final" };
  if (job.quotedTotal !== null) return { amount: job.quotedTotal, kind: "quoted" };
  return null;
}
