// Plates are stored uppercase without spaces (docs/design.md#copy-and-naming).
const MERCOSUR = /^([A-Z]{2})(\d{3})([A-Z]{2})$/;
const OLD_FORMAT = /^([A-Z]{3})(\d{3})$/;

export function formatPlate(plate: string): string {
  const value = plate.replace(/\s+/g, "").toUpperCase();
  const mercosur = MERCOSUR.exec(value);
  if (mercosur) return `${mercosur[1]} ${mercosur[2]} ${mercosur[3]}`;
  const old = OLD_FORMAT.exec(value);
  if (old) return `${old[1]} ${old[2]}`;
  return value;
}
