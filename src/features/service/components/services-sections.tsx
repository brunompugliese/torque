import { getTranslations } from "next-intl/server";

import { toListSearch, type ListParams } from "@/lib/list/params";

import { getServiceCounts, listServices } from "../queries";
import { ServicesListView } from "./services-list";

export async function ServicesSummary() {
  const [t, counts] = await Promise.all([getTranslations("services"), getServiceCounts()]);
  if (!counts.ok) return null;
  return <p>{t("summary", { total: counts.total, archived: counts.archived })}</p>;
}

export async function ServicesList({ params }: { params: ListParams }) {
  const [page, counts] = await Promise.all([listServices(params), getServiceCounts()]);
  return (
    <ServicesListView
      initial={counts.ok ? page : { ok: false }}
      initialKey={toListSearch(params)}
      total={counts.ok ? counts.total : 0}
    />
  );
}
