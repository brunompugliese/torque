// A DNI has at most 8 digits.
export const DNI_MAX_DIGITS = 8;

// What the DNI field keeps while typing: digits only, at most 8.
export function dniDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, DNI_MAX_DIGITS);
}

// DNI is stored as digits only; shown with dot thousands (docs/design.md#copy-and-naming).
export function formatDni(dni: string): string {
  return dni.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
