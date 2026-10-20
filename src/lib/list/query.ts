import { toSearchPattern } from "@/lib/search/normalize";

import { LIST_PAGE_SIZE, resolveSortBy, type ListParams } from "./params";

export interface ListQueryBuilder<Self> {
  like(column: string, pattern: string): Self;
  eq(column: string, value: boolean): Self;
  order(column: string, options: { ascending: boolean }): Self;
  range(from: number, to: number): Self;
}

export type ListQueryOptions = {
  searchColumn: string;
  // Column id (as in the URL) → database column.
  sortColumns: Record<string, string>;
  defaultSortBy: string;
};

// Searching always includes archived records (docs/design.md#search).
export function applyListQuery<Q extends ListQueryBuilder<Q>>(
  query: Q,
  params: ListParams,
  { searchColumn, sortColumns, defaultSortBy }: ListQueryOptions,
): Q {
  const pattern = toSearchPattern(params.search);
  let result = query;
  if (pattern) result = result.like(searchColumn, pattern);
  else if (!params.showArchived) result = result.eq("enabled", true);

  const sortColumn = sortColumns[resolveSortBy(params.sortBy, Object.keys(sortColumns), defaultSortBy)];
  const ascending = params.sort === "asc";
  const from = (params.page - 1) * LIST_PAGE_SIZE;
  // id breaks ties so rows never repeat across pages.
  return result
    .order(sortColumn, { ascending })
    .order("id", { ascending })
    .range(from, from + LIST_PAGE_SIZE - 1);
}
