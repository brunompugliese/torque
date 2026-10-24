export const LIST_PAGE_SIZE = 25;

export const LIST_PARAM = {
  search: "buscar",
  archived: "archivados",
  sortBy: "orden",
  sort: "sentido",
  page: "pagina",
} as const;

export type SortDirection = "asc" | "desc";

export type ListParams = {
  search: string;
  showArchived: boolean;
  // Column id; "" means no column chosen (the page's default order, no header marked).
  sortBy: string;
  sort: SortDirection;
  page: number;
  // Page-specific filters (jobs: status, dates), keyed by the URL param each page whitelists.
  filters: Record<string, string>;
};

export const DEFAULT_LIST_PARAMS: ListParams = {
  search: "",
  showArchived: false,
  sortBy: "",
  sort: "asc",
  page: 1,
  filters: {},
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function read(raw: RawParams, key: string): string | undefined {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

// A filter value is a short token list (statuses, an ISO date); anything else is dropped.
const FILTER_VALUE = /^[a-z0-9_,-]+$/;

export function parseListParams(raw: RawParams, filterKeys: readonly string[] = []): ListParams {
  const page = Number(read(raw, LIST_PARAM.page));
  const sortBy = read(raw, LIST_PARAM.sortBy) ?? "";
  const filters: Record<string, string> = {};
  for (const key of filterKeys) {
    const value = read(raw, key)?.trim() ?? "";
    if (FILTER_VALUE.test(value)) filters[key] = value;
  }
  return {
    search: read(raw, LIST_PARAM.search)?.trim() ?? "",
    showArchived: read(raw, LIST_PARAM.archived) === "1",
    sortBy: /^[a-z]+$/.test(sortBy) ? sortBy : "",
    sort: read(raw, LIST_PARAM.sort) === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page > 1 ? page : 1,
    filters,
  };
}

export function toListSearch(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set(LIST_PARAM.search, params.search);
  if (params.showArchived) search.set(LIST_PARAM.archived, "1");
  if (params.sortBy) search.set(LIST_PARAM.sortBy, params.sortBy);
  if (params.sort === "desc") search.set(LIST_PARAM.sort, "desc");
  if (params.page > 1) search.set(LIST_PARAM.page, String(params.page));
  for (const key of Object.keys(params.filters).sort()) {
    if (params.filters[key]) search.set(key, params.filters[key]);
  }
  return search.toString();
}

// Unknown ids fall back to the default, so a hand-edited URL can't pick any column.
export function resolveSortBy(sortBy: string, columnIds: readonly string[], defaultId: string): string {
  return columnIds.includes(sortBy) ? sortBy : defaultId;
}
