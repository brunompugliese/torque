"use client";

import { useTranslations } from "next-intl";

import { useListResults } from "@/hooks/use-list-results";
import { useListUrl } from "@/hooks/use-list-url";
import { toListSearch } from "@/lib/list/params";

import { searchJobs } from "../actions";
import { JOB_FILTER_KEYS } from "../list";
import type { JobPage } from "../queries";
import { JobsTable } from "./jobs-table";
import { JobsToolbar } from "./jobs-toolbar";

type JobsListProps = {
  initial: JobPage;
  initialKey: string;
  total: number;
};

function fetchPage(key: string): Promise<JobPage> {
  return searchJobs(key).catch(() => ({ ok: false }) as const);
}

export function JobsListView({ initial, initialKey, total }: JobsListProps) {
  const t = useTranslations("jobs");
  const { params } = useListUrl(JOB_FILTER_KEYS);
  // The key carries the search to the Server Action's body; the URL never holds it.
  const { result, pending, retry } = useListResults(initial, initialKey, toListSearch(params), fetchPage);

  return (
    <>
      <JobsToolbar searchPlaceholder={t("searchPlaceholder")} />
      {result.ok ? (
        <JobsTable ok rows={result.rows} matching={result.matching} total={total} pending={pending} />
      ) : (
        <JobsTable ok={false} onRetry={retry} pending={pending} />
      )}
    </>
  );
}
