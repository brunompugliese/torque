// Times of day are "HH:MM", 24 h (docs/design.md#copy-and-naming).

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "09:00:00" (how the database returns a time) → "09:00".
export function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export function isTime(value: string): boolean {
  return TIME.test(value);
}
