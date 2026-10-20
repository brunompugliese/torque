import { getTranslations } from "next-intl/server";

import type { ListParams } from "@/lib/list/params";

import { getServiceCounts, listServices } from "../queries";
import { ServicesTable } from "./services-table";

export async function ServicesSummary() {
  const [t, counts] = await Promise.all([getTranslations("services"), getServiceCounts()]);
  if (!counts.ok) return null;
  return <p>{t("summary", { total: counts.total, archived: counts.archived })}</p>;
}

export async function ServicesCount({ params }: { params: ListParams }) {
  const [t, page, counts] = await Promise.all([getTranslations("services"), listServices(params), getServiceCounts()]);
  if (!page.ok || !counts.ok) return null;
  return <>{t("count", { shown: page.matching, total: counts.total })}</>;
}

export async function ServicesList({ params }: { params: ListParams }) {
  const [page, counts] = await Promise.all([listServices(params), getServiceCounts()]);
  if (!page.ok || !counts.ok) return <ServicesTable ok={false} />;
  return <ServicesTable ok rows={page.rows} matching={page.matching} total={counts.total} />;
}
