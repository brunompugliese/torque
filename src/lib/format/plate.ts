// Plates are stored uppercase without spaces (docs/design.md#copy-and-naming).
const MERCOSUR = /^([A-Z]{2})(\d{3})([A-Z]{2})$/;
const OLD_FORMAT = /^([A-Z]{3})(\d{3})$/;

export const PLATE_MIN_LENGTH = 6;
export const PLATE_MAX_LENGTH = 7;

// Letters and digits only, uppercase: how a plate is stored (the database does the same).
export function plateCharacters(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

// While typing a plate is spaced only when it fits one of the two known shapes,
// so a finished value looks exactly like formatPlate's. Anything else stays unspaced.
const MERCOSUR_PARTIAL = /^([A-Z]{2})(\d{1,3})$/;
const MERCOSUR_FULL = /^([A-Z]{2})(\d{3})([A-Z]{1,2})$/;
const OLD_PARTIAL = /^([A-Z]{3})(\d{1,3})$/;

// What the plate field shows while typing: characters cleaned, at most 7, spaced.
export function formatPlateInput(input: string): string {
  const value = plateCharacters(input).slice(0, PLATE_MAX_LENGTH);
  const match = MERCOSUR_PARTIAL.exec(value) ?? MERCOSUR_FULL.exec(value) ?? OLD_PARTIAL.exec(value);
  return match ? match.slice(1).join(" ") : value;
}

export function formatPlate(plate: string): string {
  const value = plate.replace(/\s+/g, "").toUpperCase();
  const mercosur = MERCOSUR.exec(value);
  if (mercosur) return `${mercosur[1]} ${mercosur[2]} ${mercosur[3]}`;
  const old = OLD_FORMAT.exec(value);
  if (old) return `${old[1]} ${old[2]}`;
  return value;
}
