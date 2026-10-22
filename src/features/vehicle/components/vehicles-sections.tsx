import { getTranslations } from "next-intl/server";

import { toListSearch, type ListParams } from "@/lib/list/params";

import { getVehicleCounts, listVehicles } from "../queries";
import { VehiclesListView } from "./vehicles-list";

export async function VehiclesSummary() {
  const [t, counts] = await Promise.all([getTranslations("vehicles"), getVehicleCounts()]);
  if (!counts.ok) return null;
  return <p>{t("summary", { total: counts.total, archived: counts.archived })}</p>;
}

// The search never reaches the server in the URL (docs/architecture.md, "Never
// in URLs"): the first render has none and the first search runs on the client.
export async function VehiclesList({ params }: { params: ListParams }) {
  const listParams = { ...params, search: "" };
  const [page, counts] = await Promise.all([listVehicles(listParams), getVehicleCounts()]);
  return (
    <VehiclesListView
      initial={counts.ok ? page : { ok: false }}
      initialKey={toListSearch(listParams)}
      total={counts.ok ? counts.total : 0}
    />
  );
}
