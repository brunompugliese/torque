import { getTranslations } from "next-intl/server";

import { toListSearch, type ListParams } from "@/lib/list/params";

import { getClientCounts, listClients } from "../queries";
import { ClientsListView } from "./clients-list";

export async function ClientsSummary() {
  const [t, counts] = await Promise.all([getTranslations("clients"), getClientCounts()]);
  if (!counts.ok) return null;
  return <p>{t("summary", { total: counts.total, archived: counts.archived })}</p>;
}

export async function ClientsList({ params }: { params: ListParams }) {
  const [page, counts] = await Promise.all([listClients(params), getClientCounts()]);
  return (
    <ClientsListView
      initial={counts.ok ? page : { ok: false }}
      initialKey={toListSearch(params)}
      total={counts.ok ? counts.total : 0}
    />
  );
}
