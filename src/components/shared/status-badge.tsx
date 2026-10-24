import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { jobStatusFamily, type JobStatus, type StatusFamily } from "@/lib/status";

// Tailwind needs whole class names, so each family spells its tokens out. Badge = tinted fill +
// dark text + a border in the same text color, softened: every status has the same border
// (docs/design.md#visual-identity). The `-dot` tokens are for the calendar's card edges.
const FAMILY_CLASS: Record<StatusFamily, string> = {
  pending: "border-status-pending-foreground/20 bg-status-pending text-status-pending-foreground",
  "quote-sent": "border-status-quote-sent-foreground/20 bg-status-quote-sent text-status-quote-sent-foreground",
  "quote-accepted":
    "border-status-quote-accepted-foreground/20 bg-status-quote-accepted text-status-quote-accepted-foreground",
  "in-progress": "border-status-in-progress-foreground/20 bg-status-in-progress text-status-in-progress-foreground",
  done: "border-status-done-foreground/20 bg-status-done text-status-done-foreground",
  delivered: "border-status-delivered-foreground/20 bg-status-delivered text-status-delivered-foreground",
  cancelled: "border-status-cancelled-foreground/20 bg-status-cancelled text-status-cancelled-foreground",
};

// The text is always visible: status is never conveyed by color alone. `trailing` is an icon
// inside the pill after the text (the dropdown arrow, the lock of a closed job), in the pill's color.
export function StatusBadge({
  family,
  trailing,
  children,
}: {
  family: StatusFamily;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Badge variant="outline" className={FAMILY_CLASS[family]}>
      {children}
      {trailing}
    </Badge>
  );
}

export function JobStatusBadge({ status, trailing }: { status: JobStatus; trailing?: ReactNode }) {
  const t = useTranslations("status.job");
  return (
    <StatusBadge family={jobStatusFamily(status)} trailing={trailing}>
      {t(status)}
    </StatusBadge>
  );
}
