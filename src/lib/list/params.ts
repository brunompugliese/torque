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
  // Column id; "" means the page's default column.
  sortBy: string;
  sort: SortDirection;
  page: number;
};

export const DEFAULT_LIST_PARAMS: ListParams = {
  search: "",
  showArchived: false,
  sortBy: "",
  sort: "asc",
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function read(raw: RawParams, key: string): string | undefined {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseListParams(raw: RawParams): ListParams {
  const page = Number(read(raw, LIST_PARAM.page));
  const sortBy = read(raw, LIST_PARAM.sortBy) ?? "";
  return {
    search: read(raw, LIST_PARAM.search)?.trim() ?? "",
    showArchived: read(raw, LIST_PARAM.archived) === "1",
    sortBy: /^[a-z]+$/.test(sortBy) ? sortBy : "",
    sort: read(raw, LIST_PARAM.sort) === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function toListSearch(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set(LIST_PARAM.search, params.search);
  if (params.showArchived) search.set(LIST_PARAM.archived, "1");
  if (params.sortBy) search.set(LIST_PARAM.sortBy, params.sortBy);
  if (params.sort === "desc") search.set(LIST_PARAM.sort, "desc");
  if (params.page > 1) search.set(LIST_PARAM.page, String(params.page));
  return search.toString();
}

// Unknown ids fall back to the default, so a hand-edited URL can't pick any column.
export function resolveSortBy(sortBy: string, columnIds: readonly string[], defaultId: string): string {
  return columnIds.includes(sortBy) ? sortBy : defaultId;
}
