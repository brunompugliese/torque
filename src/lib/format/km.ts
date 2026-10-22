import { formatThousands } from "./number";

// Kilometers: dot thousands + "km" (docs/design.md#copy-and-naming).
export function formatKm(km: number): string {
  return `${formatThousands(String(Math.max(0, Math.round(km))))} km`;
}
