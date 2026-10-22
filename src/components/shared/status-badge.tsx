import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { jobStatusFamily, type JobStatus, type StatusFamily } from "@/lib/status";

// Tailwind needs whole class names, so each family spells its tokens out.
// Badge = tinted fill + dark text + colored dot (docs/design.md#visual-identity);
// the done and cancelled families also have a border.
const FAMILY_CLASS: Record<StatusFamily, { badge: string; dot: string }> = {
  pending: {
    badge: "border-transparent bg-status-pending text-status-pending-foreground",
    dot: "bg-status-pending-dot",
  },
  "quote-sent": {
    badge: "border-transparent bg-status-quote-sent text-status-quote-sent-foreground",
    dot: "bg-status-quote-sent-dot",
  },
  "quote-accepted": {
    badge: "border-transparent bg-status-quote-accepted text-status-quote-accepted-foreground",
    dot: "bg-status-quote-accepted-dot",
  },
  "in-progress": {
    badge: "border-transparent bg-status-in-progress text-status-in-progress-foreground",
    dot: "bg-status-in-progress-dot",
  },
  done: {
    badge: "border-status-done-border bg-status-done text-status-done-foreground",
    dot: "bg-status-done-dot",
  },
  delivered: {
    badge: "border-transparent bg-status-delivered text-status-delivered-foreground",
    dot: "bg-status-delivered-dot",
  },
  cancelled: {
    badge: "border-status-cancelled-border bg-status-cancelled text-status-cancelled-foreground",
    dot: "bg-status-cancelled-dot",
  },
};

// The text is always visible: status is never conveyed by color alone.
export function StatusBadge({ family, children }: { family: StatusFamily; children: ReactNode }) {
  const { badge, dot } = FAMILY_CLASS[family];
  return (
    <Badge variant="outline" className={badge}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {children}
    </Badge>
  );
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const t = useTranslations("status.job");
  return <StatusBadge family={jobStatusFamily(status)}>{t(status)}</StatusBadge>;
}
