import { formatThousands } from "./number";

// Kilometers: dot thousands + "km" (docs/design.md#copy-and-naming).
export function formatKm(km: number): string {
  return `${formatThousands(String(Math.max(0, Math.round(km))))} km`;
}

// The most digits the database column takes (a 32-bit integer).
const KM_INPUT_MAX_DIGITS = 10;

// What a kilometers input keeps while the user types or pastes: digits only,
// shown with dot thousands ("68400" → "68.400").
export function formatKmInput(input: string): string {
  return formatThousands(input.replace(/\D/g, "").slice(0, KM_INPUT_MAX_DIGITS));
}
