// The job's number as every screen shows it: "N° 000123" (docs/design.md#copy-and-naming).
// The database stores only the integer.
const JOB_NUMBER_DIGITS = 6;

export function formatJobNumber(number: number): string {
  return `N° ${String(number).padStart(JOB_NUMBER_DIGITS, "0")}`;
}
