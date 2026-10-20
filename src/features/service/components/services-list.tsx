"use client";

import { useTranslations } from "next-intl";

import { useListResults } from "@/hooks/use-list-results";
import { useListUrl } from "@/hooks/use-list-url";
import { toListSearch } from "@/lib/list/params";

import { searchServices } from "../actions";
import type { ServicePage } from "../queries";
import { ServicesTable } from "./services-table";
import { ServicesToolbar } from "./services-toolbar";

type ServicesListProps = {
  initial: ServicePage;
  initialKey: string;
  total: number;
};

function fetchPage(key: string): Promise<ServicePage> {
  return searchServices(key).catch(() => ({ ok: false }) as const);
}

export function ServicesListView({ initial, initialKey, total }: ServicesListProps) {
  const t = useTranslations("services");
  const { params } = useListUrl();
  const { result, retry } = useListResults(initial, initialKey, toListSearch(params), fetchPage);

  return (
    <>
      <ServicesToolbar count={result.ok ? t("count", { shown: result.matching, total }) : null} />
      {result.ok ? (
        <ServicesTable ok rows={result.rows} matching={result.matching} total={total} />
      ) : (
        <ServicesTable ok={false} onRetry={retry} />
      )}
    </>
  );
}
