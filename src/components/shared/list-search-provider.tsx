"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Holds a list's search text in component state instead of the URL, for pages
// whose search can contain personal or vehicle-identifying data (docs/architecture.md,
// "Never in URLs"). `searchValue` is what the box shows; `search` is what the list
// uses, committed by useListUrl after its debounce. Sort, page and the archived
// switch stay in the URL. Reloading starts with no search, by design.
type ListSearchState = {
  search: string;
  searchValue: string;
  setSearch: (search: string) => void;
  setSearchValue: (value: string) => void;
};

const ListSearchContext = createContext<ListSearchState | null>(null);

// null when the page keeps its search in the URL.
export function useListSearch(): ListSearchState | null {
  return useContext(ListSearchContext);
}

export function ListSearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const value = useMemo(() => ({ search, searchValue, setSearch, setSearchValue }), [search, searchValue]);

  return <ListSearchContext.Provider value={value}>{children}</ListSearchContext.Provider>;
}
