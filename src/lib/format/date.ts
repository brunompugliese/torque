export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

// The latest model year a vehicle can have: next year, by the Argentine calendar.
export function maxVehicleYear(now: Date = new Date()): number {
  const year = new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: APP_TIME_ZONE }).format(now);
  return Number(year) + 1;
}

// The time zone is in the options so server and browser render the same day.
export const DATE_FORMAT = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
} as const satisfies Intl.DateTimeFormatOptions;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// The earliest day a date filter takes. A date input passes through "0002-02-20" while the year is
// being typed ("2", "20", "202", "2026"): those are not days anyone filters by.
export const MIN_FILTER_YEAR = 1900;

// A "yyyy-mm-dd" that is a real calendar day, from 1900 on.
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < MIN_FILTER_YEAR) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// "2026-09-01" → "01/09/2026": a day picked in a filter, shown as dd/mm/aaaa.
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Argentina has no daylight saving: its day starts at 03:00 UTC, always.
const ARGENTINA_UTC_OFFSET_HOURS = 3;

// The instant a calendar day starts in Argentina, as an ISO timestamp ("2026-09-01" → "2026-09-01T03:00:00.000Z").
export function argentinaDayStart(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, ARGENTINA_UTC_OFFSET_HOURS)).toISOString();
}

// The start of the day after: the exclusive end of a "Hasta" date.
export function argentinaNextDayStart(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, ARGENTINA_UTC_OFFSET_HOURS)).toISOString();
}

// "22/10/2026 21:47" in Argentina time; messages add " hs" where the sentence needs it.
export function formatDateTime(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}
