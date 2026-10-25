import { normalizeAnchor, parseIsoDay, type CalendarView } from "@/lib/calendar";

// The calendar's state in the URL: `?vista=semana&fecha=2026-10-12`. Both are absent at their
// defaults (the month, and the day it starts on today). Nothing here is sensitive.
export const CALENDAR_VIEW_PARAM = "vista";
export const CALENDAR_DATE_PARAM = "fecha";
const WEEK_VALUE = "semana";

export type CalendarState = { view: CalendarView; anchor: string };

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function first(raw: RawParams, name: string): string | null {
  if (raw instanceof URLSearchParams) return raw.get(name);
  const value = raw[name];
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

// Whatever the URL says, a valid state: unknown values fall back to the month of today.
export function parseCalendarState(raw: RawParams, today: string): CalendarState {
  const view: CalendarView = first(raw, CALENDAR_VIEW_PARAM) === WEEK_VALUE ? "week" : "month";
  return { view, anchor: normalizeAnchor(view, parseIsoDay(first(raw, CALENDAR_DATE_PARAM)) ?? today) };
}

// The query string for a state, without the "?" and without what is already the default.
export function toCalendarSearch(state: CalendarState, today: string): string {
  const params = new URLSearchParams();
  if (state.view === "week") params.set(CALENDAR_VIEW_PARAM, WEEK_VALUE);
  if (state.anchor !== normalizeAnchor(state.view, today)) params.set(CALENDAR_DATE_PARAM, state.anchor);
  return params.toString();
}

// The key a state loads under: the view and the anchor.
export function calendarKey(state: CalendarState): string {
  return `${state.view}:${state.anchor}`;
}
