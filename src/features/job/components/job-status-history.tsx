"use client";

import { useTranslations } from "next-intl";

import { JobStatusBadge } from "@/components/shared/status-badge";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { formatDateTime } from "@/lib/format/date";

import type { JobHistoryEntry } from "../schemas";

// Every status change of the job, newest first: the new status as its pill, then who and when.
// Where it came from is the entry below, and the oldest entry is the creation.
export function JobStatusHistory({ entries }: { entries: readonly JobHistoryEntry[] }) {
  const t = useTranslations("jobs.history");

  return (
    <StatusTimeline
      ariaLabel={t("title")}
      entries={entries.map((entry) => ({
        id: entry.id,
        title: <JobStatusBadge status={entry.newStatus} />,
        meta: [entry.changedBy, formatDateTime(entry.changedAt)].filter(Boolean).join(" · "),
      }))}
    />
  );
}
