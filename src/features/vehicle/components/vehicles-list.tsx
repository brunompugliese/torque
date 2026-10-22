"use client";

import { useTranslations } from "next-intl";

import { ListUrlToolbar } from "@/components/shared/list-url-toolbar";
import { useListResults } from "@/hooks/use-list-results";
import { useListUrl } from "@/hooks/use-list-url";
import { toListSearch } from "@/lib/list/params";

import { searchVehicles } from "../actions";
import type { VehiclePage } from "../queries";
import { VehiclesTable } from "./vehicles-table";

type VehiclesListProps = {
  initial: VehiclePage;
  initialKey: string;
  total: number;
};

function fetchPage(key: string): Promise<VehiclePage> {
  return searchVehicles(key).catch(() => ({ ok: false }) as const);
}

export function VehiclesListView({ initial, initialKey, total }: VehiclesListProps) {
  const t = useTranslations("vehicles");
  const { params } = useListUrl();
  // The key carries the search to the Server Action's body; the URL never holds it.
  const { result, pending, retry } = useListResults(initial, initialKey, toListSearch(params), fetchPage);

  return (
    <>
      <ListUrlToolbar searchPlaceholder={t("searchPlaceholder")} />
      {result.ok ? (
        <VehiclesTable ok rows={result.rows} matching={result.matching} total={total} pending={pending} />
      ) : (
        <VehiclesTable ok={false} onRetry={retry} pending={pending} />
      )}
    </>
  );
}
