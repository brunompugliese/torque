import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ListSearchProvider } from "@/components/shared/list-search-provider";
import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { JobsPanel } from "@/features/job/components/jobs-panel";
import { JobsList, JobsSummary } from "@/features/job/components/jobs-sections";
import { JobsTableSkeleton } from "@/features/job/components/jobs-table";
import { NewJobButton } from "@/features/job/components/new-job-button";
import { JOB_FILTER_KEYS } from "@/features/job/list";
import { requireSession } from "@/lib/auth/session";
import { parseListParams } from "@/lib/list/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("jobs.title")} · ${t("app.name")}` };
}

export default async function JobsPage({ searchParams }: PageProps<"/trabajos">) {
  await requireSession();
  const [t, params] = await Promise.all([
    getTranslations("jobs"),
    searchParams.then((raw) => parseListParams(raw, JOB_FILTER_KEYS)),
  ]);

  return (
    <ListSearchProvider>
      <JobsPanel>
        <PageHeader
          title={t("title")}
          description={
            <Suspense fallback={<TextSkeleton className="w-56" />}>
              <JobsSummary />
            </Suspense>
          }
          actions={<NewJobButton />}
        />
        <Suspense
          fallback={
            <>
              <ListToolbarSkeleton />
              <JobsTableSkeleton />
            </>
          }
        >
          <JobsList params={params} />
        </Suspense>
      </JobsPanel>
    </ListSearchProvider>
  );
}
