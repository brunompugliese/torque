"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { ArchiveConfirmDialog, ArchiveToggleButton } from "@/components/shared/archive-controls";
import { DetailList } from "@/components/shared/detail-list";
import { DetailModalBodySkeleton, type DetailModalProps } from "@/components/shared/detail-modal";
import { ListError } from "@/components/shared/list-states";
import { PlateDisplay } from "@/components/shared/plate-display";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { Button } from "@/components/ui/button";
import { formatClientName } from "@/features/client/format";
import { useArchiveFlow } from "@/hooks/use-archive-flow";
import { useLoadedData } from "@/hooks/use-loaded-data";
import { fail } from "@/lib/actions/result";
import { DATE_FORMAT } from "@/lib/format/date";
import { formatKm } from "@/lib/format/km";
import { formatPlate } from "@/lib/format/plate";
import { isClosedStatus } from "@/lib/status";

import { createJob, getJobDetails, setJobArchived, updateJob, type JobActionResult } from "../actions";
import { formatJobLabel, formatJobVehicle } from "../format";
import { isJobUnchanged } from "../form";
import type { JobFormValues, JobItem, JobListItem } from "../schemas";
import { JobDetailSections } from "./job-detail-sections";
import { JobForm } from "./job-form";
import { JobStatusControl } from "./job-status-control";

export type JobModalMode = "view" | "edit" | "create";

// When the job modal is a step inside another modal (client → vehicle → job).
export type JobFromHost = {
  // "Volver" in the job goes one step back.
  onBack: () => void;
};

type UseJobModalOptions = {
  mode: JobModalMode;
  job: JobListItem | null;
  onModeChange: (mode: JobModalMode, job?: JobListItem) => void;
  // Closes the whole modal (the X, and after any action).
  onClose: () => void;
  fromHost?: JobFromHost;
  // Inicio shows the job without actions: no "Archivar" and no "Editar trabajo".
  readOnly?: boolean;
};

export type JobModalContent = Pick<
  DetailModalProps,
  "title" | "badge" | "wide" | "subtitle" | "actions" | "createdOn" | "footer" | "onBack" | "children"
>;

const FORM_ID = "job-form";

// What a job modal shows, for the Trabajos page and for the modals that host it as a step. The
// host renders `content` in its DetailModal and `confirmDialog` beside it. `content` is null
// when there is nothing to show.
export function useJobModal({
  mode,
  job,
  onModeChange,
  onClose,
  fromHost,
  readOnly = false,
}: UseJobModalOptions): { content: JobModalContent | null; confirmDialog: ReactNode } {
  const t = useTranslations("jobs");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [saving, setSaving] = useState(false);

  // Editing starts from the saved services.
  const editing = mode === "edit" && job !== null;
  const savedItems = useLoadedData(editing ? `items:${job.id}` : "items:none", async (): Promise<JobItem[] | null> => {
    if (!editing) return null;
    const result = await getJobDetails(job.id);
    if (!result.ok) throw new Error("items");
    return result.items;
  });

  const archiveFlow = useArchiveFlow({
    run: async (archived) => (job ? setJobArchived(job.id, archived) : fail("notFound")),
    notify: (archived, saved) => ({
      title: t(archived ? "toasts.archived" : "toasts.unarchived"),
      description: formatJobLabel(saved),
    }),
    onDone: onClose,
    errorMessage: tCommon("unexpectedError"),
  });

  const confirmDialog = (
    <ArchiveConfirmDialog flow={archiveFlow} title={t("archiveConfirm.title")} detail={t("archiveConfirm.body")} />
  );

  const submit = async (values: JobFormValues, items: readonly JobItem[]): Promise<JobActionResult | void> => {
    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createJob(values);
        if (!result.ok) return result;
        toast(t("toasts.created"), { description: formatJobLabel(result.data) });
        // Every action closes the modal, the whole chain when it is a step of another.
        onClose();
        return result;
      }
      if (!job) return;
      if (isJobUnchanged(values, job, items)) {
        onModeChange("view");
        return;
      }
      const result = await updateJob(job.id, values);
      if (result.ok) {
        toast(t("toasts.updated"), { description: formatJobLabel(result.data) });
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

  if (mode === "create") {
    return {
      confirmDialog,
      content: {
        wide: true,
        title: t("add"),
        subtitle: tCommon("requiredFields"),
        // Cancelar closes, or goes back to the step that opened the form.
        footer: formFooter(t("form.submit"), fromHost ? fromHost.onBack : onClose),
        children: <JobForm key="create" id={FORM_ID} onSubmit={(values) => submit(values, [])} />,
      },
    };
  }

  if (!job) return { content: null, confirmDialog };

  if (mode === "edit" && !isClosedStatus(job.status)) {
    const items = savedItems.status === "ready" ? savedItems.data : null;
    let body: ReactNode;
    if (savedItems.status === "error") body = <ListError onRetry={savedItems.retry} />;
    else if (!items) body = <DetailModalBodySkeleton rows={4} />;
    else body = <JobForm key={`edit-${job.id}`} id={FORM_ID} job={job} items={items} onSubmit={(values) => submit(values, items)} />;

    return {
      confirmDialog,
      content: {
        wide: true,
        title: t("edit"),
        subtitle: (
          <>
            <span className="block font-medium text-foreground">
              {formatPlate(job.vehicle.plate)} · {formatJobVehicle(job)}
            </span>
            {tCommon("requiredFields")}
          </>
        ),
        footer: formFooter(t("save"), () => onModeChange("view")),
        children: body,
      },
    };
  }

  const notLoaded = <span className="text-muted-foreground">{t("notLoaded")}</span>;
  const closed = isClosedStatus(job.status);
  const { client } = job;

  return {
    confirmDialog,
    content: {
      wide: true,
      title: (
        <span className="flex flex-wrap items-center gap-3">
          <PlateDisplay plate={job.vehicle.plate} />
          <span>{formatJobVehicle(job)}</span>
        </span>
      ),
      badge: (
        <>
          <JobStatusControl job={job} readOnly={readOnly} onChanged={onClose} />
          {job.enabled ? null : <ArchivedBadge />}
        </>
      ),
      actions: readOnly ? null : (
        <>
          <ArchiveToggleButton archived={!job.enabled} flow={archiveFlow} />
          {closed ? null : <Button onClick={() => onModeChange("edit")}>{t("edit")}</Button>}
        </>
      ),
      createdOn: format.dateTime(new Date(job.createdAt), DATE_FORMAT),
      onBack: fromHost?.onBack,
      children: (
        <>
          <DetailList
            twoColumns
            items={[
              {
                label: t("details.client"),
                value: client ? (
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className={client.enabled ? undefined : "text-muted-foreground"}>{formatClientName(client)}</span>
                      {client.enabled ? null : <ArchivedBadge />}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {client.phoneNumber}
                      <WhatsappButton
                        phone={client.phoneNumber}
                        label={tCommon("whatsapp")}
                        text={tCommon("whatsappText")}
                      />
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t("noClient")}</span>
                ),
              },
              { label: t("details.kilometers"), value: job.kilometers === null ? notLoaded : formatKm(job.kilometers) },
              {
                label: t("details.observations"),
                wide: true,
                value: job.observations ?? <span className="text-muted-foreground">{t("noObservations")}</span>,
              },
            ]}
          />
          <JobDetailSections key={job.id} jobId={job.id} status={job.status} />
        </>
      ),
    },
  };
}
