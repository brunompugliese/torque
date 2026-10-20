import { normalizeSearch } from "@/lib/search/normalize";

import { pageCount } from "./pagination";

// For short lists that are already loaded: filters like the database search
// does (case, accents, spaces, dots and dashes ignored) and keeps the order.
export function filterByText<Item>(items: readonly Item[], term: string, getText: (item: Item) => string): Item[] {
  const needle = normalizeSearch(term);
  if (!needle) return [...items];
  return items.filter((item) => normalizeSearch(getText(item)).includes(needle));
}

export type MemoryPage<Item> = {
  rows: Item[];
  // The page actually shown: the requested one, kept inside 1..pages.
  page: number;
  pages: number;
  total: number;
};

export function paginate<Item>(items: readonly Item[], page: number, pageSize: number): MemoryPage<Item> {
  const pages = pageCount(items.length, pageSize);
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const from = (current - 1) * pageSize;
  return { rows: items.slice(from, from + pageSize), page: current, pages, total: items.length };
}
