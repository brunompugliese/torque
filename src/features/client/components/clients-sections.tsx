import { getTranslations } from "next-intl/server";

import { toListSearch, type ListParams } from "@/lib/list/params";

import { getClientCounts, listClients } from "../queries";
import { ClientsListView } from "./clients-list";

export async function ClientsSummary() {
  const [t, counts] = await Promise.all([getTranslations("clients"), getClientCounts()]);
  if (!counts.ok) return null;
  return <p>{t("summary", { total: counts.total, archived: counts.archived })}</p>;
}

// The search never reaches the server in the URL (docs/architecture.md, "Never
// in URLs"): the first render has none and the first search runs on the client.
export async function ClientsList({ params }: { params: ListParams }) {
  const listParams = { ...params, search: "" };
  const [page, counts] = await Promise.all([listClients(listParams), getClientCounts()]);
  return (
    <ClientsListView
      initial={counts.ok ? page : { ok: false }}
      initialKey={toListSearch(listParams)}
      total={counts.ok ? counts.total : 0}
    />
  );
}
