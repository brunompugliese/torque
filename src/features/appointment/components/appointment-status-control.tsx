"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AppointmentStatusSelect } from "@/components/shared/status-select";
import type { AppointmentStatus } from "@/lib/status";

import { setAppointmentStatus } from "../actions";
import { formatAppointmentLabel } from "../format";
import type { AppointmentListItem } from "../schemas";
import { STATUS_TOAST, needsConfirmation } from "../status-change";

type AppointmentStatusControlProps = {
  appointment: Pick<AppointmentListItem, "id" | "status" | "date" | "time" | "vehicle">;
  // Called after the status changed (the modal closes, as after any action).
  onChanged: () => void;
};

// The appointment's status pill: a dropdown with every status, to jump to any of them. Cancelling
// asks first; the other changes are reversible and ask nothing.
export function AppointmentStatusControl({ appointment, onChanged }: AppointmentStatusControlProps) {
  const t = useTranslations("appointments");
  const tCommon = useTranslations("common");
  // Plain state, not a transition: the new status shows right away while the save runs.
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<AppointmentStatus | null>(null);
  const [optimistic, setOptimistic] = useState<{ from: AppointmentStatus; to: AppointmentStatus } | null>(null);

  const shown = optimistic && optimistic.from === appointment.status ? optimistic.to : appointment.status;

  async function run(next: AppointmentStatus) {
    setPending(true);
    setOptimistic({ from: appointment.status, to: next });
    const result = await setAppointmentStatus(appointment.id, next).catch(() => null);
    setPending(false);
    if (result?.ok) {
      toast(t(`toasts.${STATUS_TOAST[next]}`), { description: formatAppointmentLabel(result.data) });
      onChanged();
      return;
    }
    setOptimistic(null);
    toast.error(result && !result.ok && result.error === "notFound" ? t("errors.notFound") : tCommon("unexpectedError"));
  }

  const change = (next: AppointmentStatus) =>
    needsConfirmation(appointment.status, next) ? setConfirming(next) : void run(next);

  return (
    <span>
      <AppointmentStatusSelect status={shown} onChange={change} label={t("statusChange")} disabled={pending} />
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={t("cancelConfirm.title")}
        description={<p>{t("cancelConfirm.body")}</p>}
        confirmLabel={t("cancelConfirm.confirm")}
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
