"use client";

import { useTranslations } from "next-intl";

import { STATUS_DOT_CLASS } from "@/components/shared/status-badge";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { formatDateTime } from "@/lib/format/date";
import { jobStatusFamily } from "@/lib/status";

import type { JobHistoryEntry } from "../schemas";

// Every status change of the job, newest first: the new status as plain text with a dot in its color, then who and when.
// Where it came from is the entry below, and the oldest entry is the creation.
export function JobStatusHistory({ entries }: { entries: readonly JobHistoryEntry[] }) {
  const t = useTranslations("jobs.history");
  const tStatus = useTranslations("status.job");

  return (
    <StatusTimeline
      ariaLabel={t("title")}
      entries={entries.map((entry) => ({
        id: entry.id,
        title: <span className="text-sm font-semibold">{tStatus(entry.newStatus)}</span>,
        dotClassName: STATUS_DOT_CLASS[jobStatusFamily(entry.newStatus)],
        meta: [entry.changedBy, formatDateTime(entry.changedAt)].filter(Boolean).join(" · "),
      }))}
    />
  );
}
