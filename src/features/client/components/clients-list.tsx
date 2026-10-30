"use client";

import { useTranslations } from "next-intl";

import { ListUrlToolbar } from "@/components/shared/list-url-toolbar";
import { useListResults } from "@/hooks/use-list-results";
import { useListUrl } from "@/hooks/use-list-url";
import { toListSearch } from "@/lib/list/params";

import { searchClients } from "../actions";
import type { ClientPage } from "../queries";
import { ClientsTable } from "./clients-table";

type ClientsListProps = {
  initial: ClientPage;
  initialKey: string;
  total: number;
};

function fetchPage(key: string): Promise<ClientPage> {
  return searchClients(key).catch(() => ({ ok: false }) as const);
}

export function ClientsListView({ initial, initialKey, total }: ClientsListProps) {
  const t = useTranslations("clients");
  const { params } = useListUrl();
  // The key carries the search to the Server Action's body; the URL never holds it.
  const { result, pending, retry } = useListResults(initial, initialKey, toListSearch(params), fetchPage);

  return (
    <>
      <ListUrlToolbar searchPlaceholder={t("searchPlaceholder")} />
      {result.ok ? (
        <ClientsTable ok rows={result.rows} matching={result.matching} total={total} pending={pending} />
      ) : (
        <ClientsTable ok={false} onRetry={retry} pending={pending} />
      )}
    </>
  );
}
