"use client";

import { useTranslations } from "next-intl";

import { ListToolbar } from "@/components/shared/list-toolbar";
import { useListUrl } from "@/hooks/use-list-url";

// Outside the list's Suspense boundary so the search box keeps focus.
export function ClientsToolbar() {
  const t = useTranslations("clients");
  const { params, searchValue, setSearchValue, setShowArchived } = useListUrl();

  return (
    <ListToolbar
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder={t("searchPlaceholder")}
      showArchived={params.showArchived}
      onShowArchivedChange={setShowArchived}
    />
  );
}
