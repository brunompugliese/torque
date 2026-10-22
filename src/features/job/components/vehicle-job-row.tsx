import { useFormatter, useTranslations } from "next-intl";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { DATE_FORMAT } from "@/lib/format/date";
import { formatKm } from "@/lib/format/km";
import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils";

import type { VehicleJob } from "../schemas";
import { jobTotal } from "../total";

const EMPTY = "—";

// One visit in a vehicle's history, on two lines so it fits the modal: date,
// km and status, then the services and the total. Not clickable until the
// Trabajos page exists.
export function VehicleJobRow({ job }: { job: VehicleJob }) {
  const t = useTranslations("vehicles.history");
  const format = useFormatter();
  const total = jobTotal(job);
  const services = job.services.join(", ");

  return (
    <div className={cn("flex flex-col gap-1", !job.enabled && "opacity-60")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="whitespace-nowrap tabular-nums">{format.dateTime(new Date(job.createdAt), DATE_FORMAT)}</span>
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {job.kilometers === null ? EMPTY : formatKm(job.kilometers)}
          </span>
          {job.enabled ? null : <ArchivedBadge />}
        </div>
        <JobStatusBadge status={job.status} />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{services || EMPTY}</span>
        {total ? (
          <span className="shrink-0 text-sm whitespace-nowrap tabular-nums">
            {formatMoney(total.amount)}{" "}
            <span className="text-xs text-muted-foreground">{t(total.kind === "final" ? "final" : "quoted")}</span>
          </span>
        ) : (
          <span className="shrink-0 text-sm text-muted-foreground">{EMPTY}</span>
        )}
      </div>
    </div>
  );
}
