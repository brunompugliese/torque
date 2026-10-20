"use client";

import { useListResults } from "@/hooks/use-list-results";
import { useListUrl } from "@/hooks/use-list-url";
import { toListSearch } from "@/lib/list/params";

import { searchClients } from "../actions";
import type { ClientPage } from "../queries";
import { ClientsTable } from "./clients-table";
import { ClientsToolbar } from "./clients-toolbar";

type ClientsListProps = {
  initial: ClientPage;
  initialKey: string;
  total: number;
};

function fetchPage(key: string): Promise<ClientPage> {
  return searchClients(key).catch(() => ({ ok: false }) as const);
}

export function ClientsListView({ initial, initialKey, total }: ClientsListProps) {
  const { params } = useListUrl();
  const { result, retry } = useListResults(initial, initialKey, toListSearch(params), fetchPage);

  return (
    <>
      <ClientsToolbar />
      {result.ok ? (
        <ClientsTable ok rows={result.rows} matching={result.matching} total={total} />
      ) : (
        <ClientsTable ok={false} onRetry={retry} />
      )}
    </>
  );
}
