export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

// The time zone is in the options so server and browser render the same day.
export const DATE_FORMAT = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
} as const satisfies Intl.DateTimeFormatOptions;
