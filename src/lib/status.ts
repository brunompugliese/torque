// Database status values → the color family of their badge. The one place that
// maps them (docs/conventions.md#colors-and-theming); the tokens are
// `--status-<family>` in globals.css.

// In display and sort order (docs/design.md#job-statuses).
export const JOB_STATUSES = [
  "pendiente",
  "presupuesto_enviado",
  "presupuesto_aceptado",
  "en_progreso",
  "completado",
  "entregado",
  "cancelado",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type StatusFamily =
  | "pending"
  | "quote-sent"
  | "quote-accepted"
  | "in-progress"
  | "done"
  | "delivered"
  | "cancelled";

const JOB_STATUS_FAMILY: Record<JobStatus, StatusFamily> = {
  pendiente: "pending",
  presupuesto_enviado: "quote-sent",
  presupuesto_aceptado: "quote-accepted",
  en_progreso: "in-progress",
  completado: "done",
  entregado: "delivered",
  cancelado: "cancelled",
};

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export function jobStatusFamily(status: JobStatus): StatusFamily {
  return JOB_STATUS_FAMILY[status];
}

// A job is closed once delivered or cancelled: it can't be edited again, only archived
// (docs/design.md#job-statuses).
const CLOSED_STATUSES: readonly JobStatus[] = ["entregado", "cancelado"];

export function isClosedStatus(status: JobStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export type JobPhase = "quote" | "work";

// Quote phase: Pendiente and the two quote statuses. Work phase: En progreso, Completado, Entregado.
// A cancelled job keeps the phase it was in: work when its items have final prices.
export function jobPhase(status: JobStatus, hasFinalPrices: boolean): JobPhase {
  if (status === "en_progreso" || status === "completado" || status === "entregado") return "work";
  if (status === "cancelado") return hasFinalPrices ? "work" : "quote";
  return "quote";
}
