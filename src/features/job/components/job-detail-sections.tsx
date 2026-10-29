"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ListError } from "@/components/shared/list-states";
import { LoadingRegion } from "@/components/shared/loading-region";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoadedData } from "@/hooks/use-loaded-data";

import { getJobDetails } from "../actions";
import type { JobListItem } from "../schemas";
import { JobServices } from "./job-services";
import { PrintJobButton } from "./print-job-button";
import { QuoteButton } from "./quote-button";
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

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  // Right of the heading, on the same row.
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id={id} className="text-base font-semibold">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// The job's services and status history, loaded when the modal shows them (one
// request for both). Key it by the job so another job starts fresh. The services
// heading carries "Enviar presupuesto", which needs the loaded services.
export function JobDetailSections({ job }: { job: JobListItem }) {
  const { id: jobId, status } = job;
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
      <Section
        id="job-services-title"
        title={tServices("title")}
        action={
          <div className="flex items-center gap-1">
            <PrintJobButton jobId={jobId} loading={!loaded} />
            <QuoteButton job={job} items={loaded ? loaded.items : null} />
          </div>
        }
      >
        {loaded ? <JobServices items={loaded.items} status={status} /> : <ServicesSkeleton />}
      </Section>
      <Section id="job-history-title" title={tHistory("title")}>
        {loaded ? <JobStatusHistory entries={loaded.history} /> : <HistorySkeleton />}
      </Section>
    </>
  );
}
