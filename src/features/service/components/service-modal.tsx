"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DetailList } from "@/components/shared/detail-list";
import { DetailModal, type DetailModalProps } from "@/components/shared/detail-modal";
import { Button } from "@/components/ui/button";
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
  const [archiving, startArchiving] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pendingRename, setPendingRename] = useState<ServiceFormValues | null>(null);
  const [renaming, setRenaming] = useState(false);

  const showSaved = (saved: Service, toastKey: "created" | "updated") => {
    toast(t(`toasts.${toastKey}`), { description: saved.name });
    onModeChange("view", saved);
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

  const setArchived = (archived: boolean) => {
    if (!service) return;
    startArchiving(async () => {
      const result = await setServiceArchived(service.id, archived);
      setConfirmArchive(false);
      if (!result.ok) {
        toast.error(tCommon("unexpectedError"));
        return;
      }
      toast(t(archived ? "toasts.archived" : "toasts.unarchived"), { description: result.data.name });
      onModeChange("view", result.data);
    });
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
          {service.enabled ? (
            <Button variant="outline" onClick={() => setConfirmArchive(true)}>
              {tCommon("archive")}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setArchived(false)} disabled={archiving}>
              {tCommon("unarchive")}
            </Button>
          )}
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
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("archiveConfirm.title")}
        description={
          <>
            <p>{tCommon("archiveConfirmBody")}</p>
            <p>{t("archiveConfirm.body")}</p>
          </>
        }
        confirmLabel={tCommon("archive")}
        onConfirm={() => setArchived(true)}
        pending={archiving}
      />
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
