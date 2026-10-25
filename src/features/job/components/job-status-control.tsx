"use client";

import { LockIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { StatusSelect } from "@/components/shared/status-select";
import { isClosedStatus, type JobStatus } from "@/lib/status";

import { setJobStatus } from "../actions";
import { formatJobLabel } from "../format";
import type { JobListItem } from "../schemas";

type JobStatusControlProps = {
  job: Pick<JobListItem, "id" | "status" | "enabled" | "vehicle">;
  // Called after the status changed (the modal closes, as after any action).
  onChanged?: () => void;
  // A view without actions (Inicio) shows the plain pill.
  readOnly?: boolean;
};

// The job's status pill: a dropdown (arrow inside) while the job is open and active, a pill with a
// lock when it is closed (Entregado, Cancelado), a plain pill when it is archived or read only.
// Closing asks first, like the form does.
export function JobStatusControl({ job, onChanged, readOnly = false }: JobStatusControlProps) {
  const t = useTranslations("jobs");
  const tCommon = useTranslations("common");
  // Plain state, not a transition: a transition holds every update made inside it until it ends, so
  // the new status would not show "right away" while the save runs.
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<JobStatus | null>(null);
  // The new status shows right away, until the list brings the saved one.
  const [optimistic, setOptimistic] = useState<{ from: JobStatus; to: JobStatus } | null>(null);

  const shown = optimistic && optimistic.from === job.status ? optimistic.to : job.status;

  // A closed job is locked: a lock inside the pill, with the reason for a screen reader.
  if (isClosedStatus(job.status)) {
    return (
      <JobStatusBadge
        status={shown}
        trailing={
          <>
            <LockIcon aria-hidden="true" />
            <span className="sr-only">{t("details.closed")}</span>
          </>
        }
      />
    );
  }
  if (readOnly || !job.enabled) return <JobStatusBadge status={shown} />;

  async function run(next: JobStatus) {
    setPending(true);
    setOptimistic({ from: job.status, to: next });
    const result = await setJobStatus(job.id, next).catch(() => null);
    setPending(false);
    if (result?.ok) {
      toast(t("toasts.statusChanged"), { description: formatJobLabel(result.data) });
      onChanged?.();
      return;
    }
    setOptimistic(null);
    toast.error(result && !result.ok && result.error === "closed" ? t("errors.closed") : tCommon("unexpectedError"));
  }

  const change = (next: JobStatus) => (isClosedStatus(next) ? setConfirming(next) : void run(next));
  const closing = confirming === "entregado" || confirming === "cancelado" ? confirming : null;

  return (
    // The row behind a list cell opens the modal: clicks here (the portaled list included) stay here.
    <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <StatusSelect status={shown} onChange={change} label={t("statusChange")} disabled={pending} />
      <ConfirmDialog
        open={closing !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={t("closing.confirmTitle")}
        description={<p>{t("closing.confirmBody", { status: t(`closing.${closing ?? "entregado"}`) })}</p>}
        confirmLabel={t("closing.confirm")}
        pending={pending}
        onConfirm={() => {
          const next = confirming;
          setConfirming(null);
          if (next) void run(next);
        }}
      />
    </span>
  );
}
