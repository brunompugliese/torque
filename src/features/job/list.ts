// List constants the browser needs. Kept apart from schemas.ts so the table
// doesn't pull Zod into the page's first load.

import { isIsoDate } from "@/lib/format/date";
import { JOB_STATUSES, type JobStatus } from "@/lib/status";

// Column id (as in the URL) → sort key in job_list.
export const JOB_SORT_COLUMNS = {
  patente: "plate",
  vehiculo: "vehicle_key",
  cliente: "client_name_key",
  estado: "status_order",
  km: "kilometers",
  total: "total_amount",
  actualizado: "updated_at",
} as const;

// The newest update first, with no header marked (docs/design.md#list-pages).
export const JOB_DEFAULT_SORT = "actualizado";
export const JOB_DEFAULT_DIRECTION = "desc";

// The URL params the jobs list keeps as filters.
export const JOB_FILTER = { status: "estado", from: "desde", to: "hasta" } as const;
export const JOB_FILTER_KEYS = [JOB_FILTER.status, JOB_FILTER.from, JOB_FILTER.to] as const;

export type JobFilters = {
  statuses: JobStatus[];
  // "yyyy-mm-dd" days (Argentina), or null for no bound.
  from: string | null;
  to: string | null;
};

// What the URL's filter params mean. Unknown statuses and impossible dates are
// dropped, and a range in the wrong order is dropped whole, so a hand-edited URL
// can never ask the database for something odd.
export function parseJobFilters(filters: Record<string, string>): JobFilters {
  const wanted = new Set((filters[JOB_FILTER.status] ?? "").split(","));
  const statuses = JOB_STATUSES.filter((status) => wanted.has(status));

  const from = isIsoDate(filters[JOB_FILTER.from] ?? "") ? filters[JOB_FILTER.from] : null;
  const to = isIsoDate(filters[JOB_FILTER.to] ?? "") ? filters[JOB_FILTER.to] : null;
  if (from && to && from > to) return { statuses, from: null, to: null };
  return { statuses, from, to };
}

// The reverse: filter params for the URL. Empty filters are left out.
export function jobFiltersToParams(filters: JobFilters): Record<string, string | undefined> {
  return {
    [JOB_FILTER.status]: filters.statuses.length > 0 ? filters.statuses.join(",") : undefined,
    [JOB_FILTER.from]: filters.from ?? undefined,
    [JOB_FILTER.to]: filters.to ?? undefined,
  };
}
