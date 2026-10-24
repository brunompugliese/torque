"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useListSearch } from "@/components/shared/list-search-provider";
import { parseListParams, toListSearch, type ListParams } from "@/lib/list/params";

export const SEARCH_DEBOUNCE_MS = 200;

const NO_FILTERS: readonly string[] = [];

// The list state: search, archived switch, sort and page. It lives in the URL,
// except the search on pages wrapped in a ListSearchProvider: there it stays in
// state and never reaches the address bar.
export function useListUrl(filterKeys: readonly string[] = NO_FILTERS) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shared = useListSearch();
  const urlParams = useMemo(
    () => parseListParams(new URLSearchParams(searchParams.toString()), filterKeys),
    [searchParams, filterKeys],
  );
  const params = useMemo(() => (shared ? { ...urlParams, search: shared.search } : urlParams), [shared, urlParams]);

  const navigate = useCallback(
    (next: ListParams) => {
      const query = toListSearch(shared ? { ...next, search: "" } : next);
      // Shallow: the list fetches its own results (useListResults).
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname, shared],
  );

  const [ownSearchValue, setOwnSearchValue] = useState(params.search);
  const searchValue = shared ? shared.searchValue : ownSearchValue;
  const setSearchValueState = shared ? shared.setSearchValue : setOwnSearchValue;
  const setSharedSearch = shared?.setSearch;

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestParams = useRef(params);
  useEffect(() => {
    latestParams.current = params;
  }, [params]);

  // Sync when the URL changes elsewhere (Back, "Borrar búsqueda"). Not needed
  // when the search lives in state: the URL never holds it.
  const [syncedSearch, setSyncedSearch] = useState(params.search);
  if (!shared && params.search !== syncedSearch) {
    setSyncedSearch(params.search);
    setOwnSearchValue(params.search);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const commitSearch = useCallback(
    (search: string) => {
      setSharedSearch?.(search);
      navigate({ ...latestParams.current, search, page: 1 });
    },
    [navigate, setSharedSearch],
  );

  const setSearchValue = useCallback(
    (value: string) => {
      setSearchValueState(value);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (value.trim() === latestParams.current.search) return;
        commitSearch(value.trim());
      }, SEARCH_DEBOUNCE_MS);
    },
    [commitSearch, setSearchValueState],
  );

  const clearSearch = useCallback(() => {
    clearTimeout(timer.current);
    setSearchValueState("");
    commitSearch("");
  }, [commitSearch, setSearchValueState]);

  const setShowArchived = useCallback(
    (showArchived: boolean) => navigate({ ...params, showArchived, page: 1 }),
    [navigate, params],
  );

  // The sorted column flips direction; any other column starts ascending.
  const toggleSort = useCallback(
    (columnId: string) => {
      const sort = columnId === params.sortBy && params.sort === "asc" ? "desc" : "asc";
      navigate({ ...params, sortBy: columnId, sort, page: 1 });
    },
    [navigate, params],
  );

  const setPage = useCallback((page: number) => navigate({ ...params, page }), [navigate, params]);

  // Merges the patch into the page's filters; an empty or undefined value removes that filter.
  const setFilters = useCallback(
    (patch: Record<string, string | undefined>) => {
      const filters = { ...params.filters };
      for (const [key, value] of Object.entries(patch)) {
        if (value) filters[key] = value;
        else delete filters[key];
      }
      navigate({ ...params, filters, page: 1 });
    },
    [navigate, params],
  );

  const clearFilters = useCallback(() => navigate({ ...params, filters: {}, page: 1 }), [navigate, params]);

  // "Limpiar búsqueda y filtros": the search text and every filter.
  const clearAll = useCallback(() => {
    clearTimeout(timer.current);
    setSearchValueState("");
    setSharedSearch?.("");
    navigate({ ...latestParams.current, search: "", filters: {}, page: 1 });
  }, [navigate, setSearchValueState, setSharedSearch]);

  return {
    params,
    searchValue,
    setSearchValue,
    clearSearch,
    setShowArchived,
    toggleSort,
    setPage,
    setFilters,
    clearFilters,
    clearAll,
  };
}
