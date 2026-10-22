"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ListError } from "@/components/shared/list-states";
import { LoadingRegion } from "@/components/shared/loading-region";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoadedData } from "@/hooks/use-loaded-data";

import { getVehicleJobs } from "../actions";
import { VehicleJobRow } from "./vehicle-job-row";

// The five most recent jobs show; "Ver todos (N)" expands the rest in place.
export const VISIBLE_JOBS = 5;

export function VehicleJobsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <LoadingRegion>
      <div className="flex flex-col divide-y rounded-lg border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <Skeleton data-testid="skeleton-block" className="h-4 w-1/2" />
              <Skeleton data-testid="skeleton-block" className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton data-testid="skeleton-block" className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

// The vehicle's job history, loaded when the modal shows it. Key it by the
// vehicle so another vehicle starts collapsed.
export function VehicleJobs({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations("vehicles.history");
  const jobs = useLoadedData(vehicleId, () => getVehicleJobs(vehicleId));
  const [expanded, setExpanded] = useState(false);

  let body;
  if (jobs.status === "loading") {
    body = <VehicleJobsSkeleton />;
  } else if (jobs.status === "error" || !jobs.data.ok) {
    body = <ListError onRetry={jobs.retry} />;
  } else if (jobs.data.rows.length === 0) {
    body = <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  } else {
    const { rows } = jobs.data;
    const shown = expanded ? rows : rows.slice(0, VISIBLE_JOBS);
    body = (
      <>
        <ul className="flex flex-col divide-y rounded-lg border">
          {shown.map((job) => (
            <li key={job.id} className="px-3 py-2.5">
              <VehicleJobRow job={job} />
            </li>
          ))}
        </ul>
        {rows.length > VISIBLE_JOBS && !expanded ? (
          <Button variant="outline" className="w-full" onClick={() => setExpanded(true)}>
            {t("seeAll", { count: rows.length })}
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <section aria-labelledby="vehicle-jobs-title" className="mt-6 flex flex-col gap-3">
      <h3 id="vehicle-jobs-title" className="text-base font-semibold">
        {t("title")}
      </h3>
      {body}
    </section>
  );
}
