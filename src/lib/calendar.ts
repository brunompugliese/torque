import { APP_TIME_ZONE, isIsoDate } from "@/lib/format/date";

// Calendar math on "yyyy-mm-dd" days. Days are plain strings, never `Date`s in the browser's time
// zone, so server and browser agree on every day (docs/design.md: Argentina time).

export type CalendarView = "month" | "week";

export const WEEK_LENGTH = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtc(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(time: number): string {
  const date = new Date(time);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${month}-${day}`;
}

// Today in Argentina, whatever the browser's or the server's time zone.
export function todayIsoDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  return fromUtc(toUtc(isoDate) + days * MS_PER_DAY);
}

// The first day of the month `months` away from the one `isoDate` is in.
export function addMonths(isoDate: string, months: number): string {
  const [year, month] = isoDate.split("-").map(Number);
  return fromUtc(Date.UTC(year, month - 1 + months, 1));
}

export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function monthEnd(isoDate: string): string {
  return addDays(addMonths(isoDate, 1), -1);
}

// 0 = Monday … 6 = Sunday: the grid starts on Monday.
export function weekdayIndex(isoDate: string): number {
  return (new Date(toUtc(isoDate)).getUTCDay() + 6) % 7;
}

export function weekDays(start: string): string[] {
  return Array.from({ length: WEEK_LENGTH }, (_, index) => addDays(start, index));
}

export type MonthCell = { date: string; inMonth: boolean };

// The weeks of the month's grid, Monday to Sunday, with the days of the neighbouring months that
// complete the first and last week.
export function monthGrid(anchor: string): MonthCell[][] {
  const first = monthStart(anchor);
  const last = monthEnd(anchor);
  const gridStart = addDays(first, -weekdayIndex(first));
  const gridEnd = addDays(last, WEEK_LENGTH - 1 - weekdayIndex(last));
  const weeks: MonthCell[][] = [];
  for (let weekStart = gridStart; weekStart <= gridEnd; weekStart = addDays(weekStart, WEEK_LENGTH)) {
    weeks.push(weekDays(weekStart).map((date) => ({ date, inMonth: date.slice(0, 7) === first.slice(0, 7) })));
  }
  return weeks;
}

// The anchor a view keeps: the month's first day, or the week's first day as it is.
export function normalizeAnchor(view: CalendarView, anchor: string): string {
  return view === "month" ? monthStart(anchor) : anchor;
}

// The days the view shows, greyed days of the month grid included: what must be loaded.
export function visibleRange(view: CalendarView, anchor: string): { from: string; to: string } {
  if (view === "week") return { from: anchor, to: addDays(anchor, WEEK_LENGTH - 1) };
  const grid = monthGrid(anchor);
  return { from: grid[0][0].date, to: grid[grid.length - 1][WEEK_LENGTH - 1].date };
}

// The period the title names: the month itself, or the seven days of the week.
export function periodRange(view: CalendarView, anchor: string): { from: string; to: string } {
  if (view === "week") return { from: anchor, to: addDays(anchor, WEEK_LENGTH - 1) };
  return { from: monthStart(anchor), to: monthEnd(anchor) };
}

// The arrows: a month, or seven days.
export function shiftAnchor(view: CalendarView, anchor: string, direction: -1 | 1): string {
  return view === "month" ? addMonths(anchor, direction) : addDays(anchor, direction * WEEK_LENGTH);
}

// "Hoy" is disabled when the view already starts on today (week) or holds it as its month.
export function isAtToday(view: CalendarView, anchor: string, today: string): boolean {
  return view === "month" ? monthStart(anchor) === monthStart(today) : anchor === today;
}

// The anchor to keep when the view changes: the month of the week shown (today when it is in it),
// or the week that starts at today, or at the month's first day.
export function switchView(next: CalendarView, anchor: string, today: string): string {
  if (next === "month") return monthStart(anchor);
  return monthStart(anchor) === monthStart(today) ? today : monthStart(anchor);
}

// Where the calendar goes to show a day: its month, or (in the week view) the week already shown if
// it holds the day, else a week that starts on it.
export function anchorForDate(view: CalendarView, anchor: string, date: string): string {
  if (view === "month") return monthStart(date);
  return date >= anchor && date <= addDays(anchor, WEEK_LENGTH - 1) ? anchor : date;
}

export function isCalendarView(value: string | null | undefined): value is CalendarView {
  return value === "month" || value === "week";
}

// A day from the outside (a URL): a real day, or null.
export function parseIsoDay(value: string | null | undefined): string | null {
  return value && isIsoDate(value) ? value : null;
}
