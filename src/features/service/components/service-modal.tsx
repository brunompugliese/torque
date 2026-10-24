"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ArchiveConfirmDialog, ArchiveToggleButton } from "@/components/shared/archive-controls";
import { ArchivedBadge } from "@/components/shared/archived-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DetailList } from "@/components/shared/detail-list";
import { DetailModal, type DetailModalProps } from "@/components/shared/detail-modal";
import { Button } from "@/components/ui/button";
import { useArchiveFlow } from "@/hooks/use-archive-flow";
import { fail } from "@/lib/actions/result";
import { DATE_FORMAT } from "@/lib/format/date";

import { createService, setServiceArchived, updateService, type ServiceActionResult } from "../actions";
import type { Service, ServiceFormValues } from "../schemas";
import { ServiceForm } from "./service-form";

export type ServiceModalMode = "view" | "edit" | "create";

const FORM_ID = "service-form";

type ServiceModalProps = {
  open: boolean;
  mode: ServiceModalMode;
  service: Service | null;
  onModeChange: (mode: ServiceModalMode, service?: Service) => void;
  onOpenChange: (open: boolean) => void;
};

type ModalContent = Pick<
  DetailModalProps,
  "title" | "badge" | "subtitle" | "actions" | "createdOn" | "footer" | "children"
>;

export function ServiceModal({ open, mode, service, onModeChange, onOpenChange }: ServiceModalProps) {
  const t = useTranslations("services");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const [saving, setSaving] = useState(false);
  const [pendingRename, setPendingRename] = useState<ServiceFormValues | null>(null);
  const [renaming, setRenaming] = useState(false);

  // Every action closes the modal and confirms with a toast (docs/design.md#modals).
  const showSaved = (saved: Service, toastKey: "created" | "updated") => {
    toast(t(`toasts.${toastKey}`), { description: saved.name });
    onOpenChange(false);
  };

  const submit = async (values: ServiceFormValues): Promise<ServiceActionResult | void> => {
    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createService(values);
        if (result.ok) showSaved(result.data, "created");
        return result;
      }
      if (!service) return;
      if (values.name === service.name && values.description === service.description) {
        onModeChange("view");
        return;
      }
      const result = await updateService(service.id, values);
      if (!result.ok && result.error === "renameNeedsConfirmation") {
        setPendingRename(values);
        return;
      }
      if (result.ok) showSaved(result.data, "updated");
      return result;
    } finally {
      setSaving(false);
    }
  };

  const confirmRename = async () => {
    if (!service || !pendingRename) return;
    setRenaming(true);
    const result = await updateService(service.id, pendingRename, { confirmRename: true });
    setRenaming(false);
    setPendingRename(null);
    if (result.ok) showSaved(result.data, "updated");
    else toast.error(tCommon("unexpectedError"));
  };

  // Archive and unarchive: the standard flow, then the modal closes (docs/design.md#archive).
  const archiveFlow = useArchiveFlow({
    run: async (archived) => (service ? setServiceArchived(service.id, archived) : fail("notFound")),
    notify: (archived, saved) => ({
      title: t(archived ? "toasts.archived" : "toasts.unarchived"),
      description: saved.name,
    }),
    onDone: () => onOpenChange(false),
    errorMessage: tCommon("unexpectedError"),
  });

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

  // One DetailModal for every mode, so switching modes doesn't reopen the dialog.
  let content: ModalContent;
  if (mode === "create") {
    content = {
      title: t("add"),
      subtitle: tCommon("requiredFields"),
      footer: formFooter(t("add"), () => onOpenChange(false)),
      children: <ServiceForm key="create" id={FORM_ID} onSubmit={submit} />,
    };
  } else if (!service) {
    return null;
  } else if (mode === "edit") {
    content = {
      title: t("edit"),
      subtitle: (
        <>
          <span className="block font-medium text-foreground">{service.name}</span>
          {tCommon("requiredFields")}
        </>
      ),
      footer: formFooter(t("save"), () => onModeChange("view")),
      children: (
        <ServiceForm
          key={`edit-${service.id}`}
          id={FORM_ID}
          defaultValues={{ name: service.name, description: service.description ?? "" }}
          onSubmit={submit}
        />
      ),
    };
  } else {
    content = {
      title: service.name,
      badge: service.enabled ? null : <ArchivedBadge />,
      actions: (
        <>
          <ArchiveToggleButton archived={!service.enabled} flow={archiveFlow} />
          <Button onClick={() => onModeChange("edit")}>{t("edit")}</Button>
        </>
      ),
      createdOn: format.dateTime(new Date(service.createdAt), DATE_FORMAT),
      children: (
        <DetailList
          items={[
            {
              label: t("fields.description"),
              value: service.description ?? <span className="text-muted-foreground">{t("noDescription")}</span>,
            },
          ]}
        />
      ),
    };
  }

  return (
    <>
      <DetailModal open={open} onOpenChange={onOpenChange} {...content} />
      <ArchiveConfirmDialog flow={archiveFlow} title={t("archiveConfirm.title")} detail={t("archiveConfirm.body")} />
      <ConfirmDialog
        open={pendingRename !== null}
        onOpenChange={(next) => {
          if (!next) setPendingRename(null);
        }}
        title={t("renameConfirm.title")}
        description={t("renameConfirm.body")}
        confirmLabel={t("renameConfirm.confirm")}
        onConfirm={confirmRename}
        pending={renaming}
      />
    </>
  );
}
