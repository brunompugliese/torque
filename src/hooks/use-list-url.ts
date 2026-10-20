"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseListParams, toListSearch, type ListParams } from "@/lib/list/params";

export const SEARCH_DEBOUNCE_MS = 200;

export function useListUrl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseListParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  const navigate = useCallback(
    (next: ListParams) => {
      const query = toListSearch(next);
      // Shallow: the list fetches its own results (useListResults).
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname],
  );

  const [searchValue, setSearchValueState] = useState(params.search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestParams = useRef(params);
  useEffect(() => {
    latestParams.current = params;
  }, [params]);

  // Sync when the URL changes elsewhere (Back, "Borrar búsqueda").
  const [syncedSearch, setSyncedSearch] = useState(params.search);
  if (params.search !== syncedSearch) {
    setSyncedSearch(params.search);
    setSearchValueState(params.search);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const setSearchValue = useCallback(
    (value: string) => {
      setSearchValueState(value);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (value.trim() === latestParams.current.search) return;
        navigate({ ...latestParams.current, search: value.trim(), page: 1 });
      }, SEARCH_DEBOUNCE_MS);
    },
    [navigate],
  );

  const clearSearch = useCallback(() => {
    clearTimeout(timer.current);
    setSearchValueState("");
    navigate({ ...params, search: "", page: 1 });
  }, [navigate, params]);

  const setShowArchived = useCallback(
    (showArchived: boolean) => navigate({ ...params, showArchived, page: 1 }),
    [navigate, params],
  );

  // The current column flips direction; another column starts ascending.
  const toggleSort = useCallback(
    (columnId: string, defaultSortBy: string) => {
      const current = params.sortBy || defaultSortBy;
      const sortBy = columnId === defaultSortBy ? "" : columnId;
      const sort = columnId === current && params.sort === "asc" ? "desc" : "asc";
      navigate({ ...params, sortBy, sort, page: 1 });
    },
    [navigate, params],
  );

  const setPage = useCallback((page: number) => navigate({ ...params, page }), [navigate, params]);

  return { params, searchValue, setSearchValue, clearSearch, setShowArchived, toggleSort, setPage };
}
