export type PageWindowItem = number | "gap";

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  return { from: Math.min(from, total), to: Math.min(page * pageSize, total) };
}

// 1 … 4 5 6 … 12
export function pageWindow(current: number, count: number): PageWindowItem[] {
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);

  const items: PageWindowItem[] = [];
  for (const page of sorted) {
    const previous = items.at(-1);
    if (typeof previous === "number" && page - previous === 2) items.push(previous + 1);
    else if (typeof previous === "number" && page - previous > 2) items.push("gap");
    items.push(page);
  }
  return items;
}
