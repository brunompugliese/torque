// Must match private.normalize_search in the database.
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s.-]/g, "");
}

export function toSearchPattern(term: string): string | null {
  const normalized = normalizeSearch(term);
  if (!normalized) return null;
  return `%${normalized.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
