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
