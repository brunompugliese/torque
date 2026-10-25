"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ListError } from "@/components/shared/list-states";
import { LoadingRegion } from "@/components/shared/loading-region";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoadedData } from "@/hooks/use-loaded-data";
import type { JobStatus } from "@/lib/status";

import { getJobDetails } from "../actions";
import { JobServices } from "./job-services";
import { JobStatusHistory } from "./job-status-history";

function ServicesSkeleton() {
  return (
    <LoadingRegion>
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} data-testid="skeleton-block" className="h-4 w-full" />
        ))}
      </div>
    </LoadingRegion>
  );
}

function HistorySkeleton() {
  return (
    <LoadingRegion>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton data-testid="skeleton-block" className="h-4 w-1/3" />
            <Skeleton data-testid="skeleton-block" className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-6 flex flex-col gap-3">
      <h3 id={id} className="text-base font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

// The job's services and status history, loaded when the modal shows them (one
// request for both). Key it by the job so another job starts fresh.
export function JobDetailSections({ jobId, status }: { jobId: string; status: JobStatus }) {
  const tServices = useTranslations("jobs.services");
  const tHistory = useTranslations("jobs.history");
  const detail = useLoadedData(jobId, () => getJobDetails(jobId));

  if (detail.status === "error" || (detail.status === "ready" && !detail.data.ok)) {
    const error = <ListError onRetry={detail.retry} />;
    return (
      <>
        <Section id="job-services-title" title={tServices("title")}>
          {error}
        </Section>
        <Section id="job-history-title" title={tHistory("title")}>
          {error}
        </Section>
      </>
    );
  }

  const loaded = detail.status === "ready" && detail.data.ok ? detail.data : null;

  return (
    <>
      <Section id="job-services-title" title={tServices("title")}>
        {loaded ? <JobServices items={loaded.items} status={status} /> : <ServicesSkeleton />}
      </Section>
      <Section id="job-history-title" title={tHistory("title")}>
        {loaded ? <JobStatusHistory entries={loaded.history} /> : <HistorySkeleton />}
      </Section>
    </>
  );
}
