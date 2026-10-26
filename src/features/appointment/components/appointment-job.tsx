"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatJobLabel } from "@/features/job/format";

import { createJobFromAppointment } from "../actions";
import type { AppointmentListItem } from "../schemas";

type AppointmentJobProps = {
  appointment: AppointmentListItem;
  // "Ver trabajo": opens the appointment's job as a step of the modal.
  onView: (jobId: string) => void;
  // After "Crear trabajo" worked: the modal closes, as after any action.
  onCreated: () => void;
};

// The "Trabajo" detail of an appointment: its job to open, or a button that creates one from what the
// appointment already knows. A cancelled appointment gets no new job; an archived vehicle can't have one.
export function AppointmentJob({ appointment, onView, onCreated }: AppointmentJobProps) {
  const t = useTranslations("appointments");
  const tCommon = useTranslations("common");
  const [creating, setCreating] = useState(false);

  if (appointment.jobId) {
    const jobId = appointment.jobId;
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => onView(jobId)}>
        {t("job.view")}
      </Button>
    );
  }

  if (appointment.status === "cancelado") return <span className="text-muted-foreground">—</span>;

  async function create() {
    setCreating(true);
    const result = await createJobFromAppointment(appointment.id).catch(() => null);
    setCreating(false);
    if (result?.ok) {
      toast(t("toasts.jobCreated"), { description: formatJobLabel(result.data) });
      onCreated();
      return;
    }
    const error = result && !result.ok ? result.error : null;
    toast.error(
      error === "cancelled"
        ? t("errors.cancelled")
        : error === "vehicleArchived"
          ? t("errors.vehicleArchived")
          : error === "notFound"
            ? t("errors.notFound")
            : tCommon("unexpectedError"),
    );
  }

  const archived = !appointment.vehicle.enabled;
  const hintId = `appointment-job-hint-${appointment.id}`;

  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={archived || creating}
        aria-busy={creating}
        aria-describedby={archived ? hintId : undefined}
        onClick={() => void create()}
      >
        {creating ? t("job.creating") : t("job.create")}
      </Button>
      {archived ? (
        <span id={hintId} className="text-xs text-muted-foreground">
          {t("job.vehicleArchived")}
        </span>
      ) : null}
    </span>
  );
}
