// What Inicio's jobs table lists (spec 009). Pure, so the rules are tested without a database.

import { addDays } from "@/lib/calendar";
import { argentinaDayStart } from "@/lib/format/date";
import { isClosedStatus, JOB_STATUSES, type JobStatus } from "@/lib/status";

// How far back the delivered and cancelled jobs go, counting today.
export const HOME_CLOSED_WINDOW_DAYS = 30;

export const HOME_OPEN_STATUSES: readonly JobStatus[] = JOB_STATUSES.filter((status) => !isClosedStatus(status));
export const HOME_CLOSED_STATUSES: readonly JobStatus[] = JOB_STATUSES.filter(isClosedStatus);

// The instant the window starts: the start (Argentina time) of the day 29 days before `today`, so
// it covers the 30 days ending today.
export function homeClosedFrom(today: string): string {
  return argentinaDayStart(addDays(today, -(HOME_CLOSED_WINDOW_DAYS - 1)));
}

// How the list narrows by the Estado selection:
//   nothing selected → the open statuses, any age
//   only open ticked → those, any age
//   only closed ticked → those, last updated inside the window
//   both → the open ones of any age together with the closed ones inside the window
export type HomeStatusFilter =
  | { kind: "in"; statuses: JobStatus[] }
  | { kind: "closed-window"; statuses: JobStatus[]; from: string }
  | { kind: "mixed"; open: JobStatus[]; closed: JobStatus[]; from: string };

export function homeStatusFilter(selected: readonly JobStatus[], closedFrom: string): HomeStatusFilter {
  if (selected.length === 0) return { kind: "in", statuses: [...HOME_OPEN_STATUSES] };
  const open = selected.filter((status) => !isClosedStatus(status));
  const closed = selected.filter(isClosedStatus);
  if (closed.length === 0) return { kind: "in", statuses: open };
  if (open.length === 0) return { kind: "closed-window", statuses: closed, from: closedFrom };
  return { kind: "mixed", open, closed, from: closedFrom };
}

// The PostgREST `or` expression of the mixed case.
export function homeMixedFilterExpression(filter: Extract<HomeStatusFilter, { kind: "mixed" }>): string {
  return `status.in.(${filter.open.join(",")}),and(status.in.(${filter.closed.join(",")}),updated_at.gte.${filter.from})`;
}
