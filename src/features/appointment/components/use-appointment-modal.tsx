"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { DetailList } from "@/components/shared/detail-list";
import { DetailModalBodySkeleton, type DetailModalProps } from "@/components/shared/detail-modal";
import { ListError } from "@/components/shared/list-states";
import { PlateDisplay } from "@/components/shared/plate-display";
import { Button } from "@/components/ui/button";
import { ClientSummary } from "@/features/client/components/client-summary";
import { getJobRow } from "@/features/job/actions";
import { useJobModal } from "@/features/job/components/use-job-modal";
import { useLoadedData } from "@/hooks/use-loaded-data";
import { DATE_FORMAT } from "@/lib/format/date";

import { createAppointment, updateAppointment, type AppointmentActionResult } from "../actions";
import { formatAppointmentLabel, formatAppointmentVehicle, formatAppointmentWhen } from "../format";
import { isAppointmentUnchanged } from "../form";
import type { AppointmentFormValues, AppointmentListItem } from "../schemas";
import { AppointmentForm } from "./appointment-form";
import { AppointmentJob } from "./appointment-job";
import { AppointmentStatusControl } from "./appointment-status-control";

// An appointment's job is one more step of the chain: viewing it or editing it.
export type AppointmentModalMode = "view" | "edit" | "create" | "job-view" | "job-edit";

type UseAppointmentModalOptions = {
  mode: AppointmentModalMode;
  appointment: AppointmentListItem | null;
  // The day a new appointment starts on.
  createDate: string;
  // The job of the job-* modes.
  jobId: string | null;
  onModeChange: (mode: AppointmentModalMode, jobId?: string) => void;
  // Closes the whole modal (the X, and after any action).
  onClose: () => void;
  // After a create or an edit: the calendar goes to the appointment's day.
  onSaved: (saved: AppointmentListItem) => void;
};

export type AppointmentModalContent = Pick<
  DetailModalProps,
  "title" | "badge" | "wide" | "subtitle" | "actions" | "createdOn" | "footer" | "onBack" | "children"
>;

const FORM_ID = "appointment-form";

// What an appointment modal shows, for the Turnos page. The host renders `content` in its
// DetailModal. `content` is null when there is nothing to show.
export function useAppointmentModal({
  mode,
  appointment,
  createDate,
  jobId,
  onModeChange,
  onClose,
  onSaved,
}: UseAppointmentModalOptions): { content: AppointmentModalContent | null; confirmDialog: ReactNode } {
  const t = useTranslations("appointments");
  const tJobs = useTranslations("jobs");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [saving, setSaving] = useState(false);

  // The job opens as a step: the same content the Trabajos page shows, with "Volver" to the
  // appointment. Only its list row is loaded here; the modal loads the rest.
  const jobMode = mode === "job-view" ? "view" : mode === "job-edit" ? "edit" : null;
  const jobRow = useLoadedData(jobMode && jobId ? `job:${jobId}` : "job:none", async () => {
    if (!jobMode || !jobId) return null;
    const result = await getJobRow(jobId);
    if (!result.ok) throw new Error("job");
    return result.row;
  });
  const job = jobMode && jobRow.status === "ready" ? jobRow.data : null;
  const backToAppointment = () => onModeChange("view");
  const jobModal = useJobModal({
    mode: jobMode ?? "view",
    job,
    onModeChange: (next) => onModeChange(next === "edit" ? "job-edit" : "job-view", jobId ?? undefined),
    onClose,
    fromHost: { onBack: backToAppointment },
  });

  const submit = async (values: AppointmentFormValues): Promise<AppointmentActionResult | void> => {
    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createAppointment(values);
        if (!result.ok) return result;
        toast(t("toasts.created"), { description: formatAppointmentLabel(result.data) });
        // Every action closes the modal, and the calendar goes to the day it was saved on first.
        onSaved(result.data);
        onClose();
        return result;
      }
      if (!appointment) return;
      if (isAppointmentUnchanged(values, appointment)) {
        onModeChange("view");
        return;
      }
      const result = await updateAppointment(appointment.id, values);
      if (result.ok) {
        toast(t("toasts.updated"), { description: formatAppointmentLabel(result.data) });
        onSaved(result.data);
        onClose();
      }
      return result;
    } finally {
      setSaving(false);
    }
  };

  const formFooter = (submitLabel: string, onCancel: () => void) => (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel} disabled={saving}>
        {tCommon("cancel")}
      </Button>
      <Button type="submit" form={FORM_ID} disabled={saving} aria-busy={saving}>
        {saving ? tCommon("saving") : submitLabel}
      </Button>
    </div>
  );

  if (jobMode) {
    if (job) return jobModal;
    return {
      confirmDialog: null,
      content: {
        wide: true,
        title: tJobs("modalTitle"),
        onBack: backToAppointment,
        children:
          jobRow.status === "error" ? <ListError onRetry={jobRow.retry} /> : <DetailModalBodySkeleton rows={4} />,
      },
    };
  }

  if (mode === "create") {
    return {
      confirmDialog: null,
      content: {
        title: t("add"),
        subtitle: tCommon("requiredFields"),
        footer: formFooter(t("form.submit"), onClose),
        children: <AppointmentForm key="create" id={FORM_ID} date={createDate} onSubmit={submit} />,
      },
    };
  }

  if (!appointment) return { content: null, confirmDialog: null };

  if (mode === "edit") {
    return {
      confirmDialog: null,
      content: {
        title: t("edit"),
        subtitle: (
          <>
            <span className="block font-medium text-foreground">{formatAppointmentWhen(appointment)}</span>
            {tCommon("requiredFields")}
          </>
        ),
        footer: formFooter(t("save"), () => onModeChange("view")),
        children: <AppointmentForm key={`edit-${appointment.id}`} id={FORM_ID} appointment={appointment} onSubmit={submit} />,
      },
    };
  }

  const { client, vehicle } = appointment;

  return {
    confirmDialog: null,
    content: {
      title: formatAppointmentWhen(appointment),
      badge: <AppointmentStatusControl appointment={appointment} onChanged={onClose} />,
      actions: <Button onClick={() => onModeChange("edit")}>{t("edit")}</Button>,
      createdOn: format.dateTime(new Date(appointment.createdAt), DATE_FORMAT),
      children: (
        <DetailList
          twoColumns
          items={[
            {
              label: t("details.client"),
              value: <ClientSummary client={client} noClient={t("noClient")} />,
            },
            {
              label: t("details.vehicle"),
              value: (
                <span className="flex flex-col items-start gap-1">
                  <PlateDisplay plate={vehicle.plate} />
                  <span className="flex items-center gap-2">
                    {formatAppointmentVehicle(appointment)}
                    {vehicle.enabled ? null : <ArchivedBadge />}
                  </span>
                </span>
              ),
            },
            {
              label: t("details.reason"),
              value: appointment.reason ?? <span className="text-muted-foreground">{t("noReason")}</span>,
            },
            {
              label: t("details.job"),
              value: (
                <AppointmentJob
                  appointment={appointment}
                  onView={(opened) => onModeChange("job-view", opened)}
                  onCreated={onClose}
                />
              ),
            },
          ]}
        />
      ),
    },
  };
}
