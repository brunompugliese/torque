// A VIN has exactly 17 characters; I, O and Q are never used.
export const VIN_LENGTH = 17;

// What the VIN field keeps while typing: no spaces or hyphens, uppercase, at most 17.
export function formatVinInput(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase().slice(0, VIN_LENGTH);
}
