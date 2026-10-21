"use client";

import { useListUrl } from "@/hooks/use-list-url";

import { ListToolbar } from "./list-toolbar";

// The list toolbar wired to the URL state: search and "Mostrar archivados".
// Render it outside the list's Suspense boundary so the search box keeps focus.
export function ListUrlToolbar({ searchPlaceholder }: { searchPlaceholder: string }) {
  const { params, searchValue, setSearchValue, setShowArchived } = useListUrl();

  return (
    <ListToolbar
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder={searchPlaceholder}
      showArchived={params.showArchived}
      onShowArchivedChange={setShowArchived}
    />
  );
}
