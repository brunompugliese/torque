"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DetailList } from "@/components/shared/detail-list";
import { DetailModal, type DetailModalProps } from "@/components/shared/detail-modal";
import { ListError } from "@/components/shared/list-states";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { Button } from "@/components/ui/button";
import { assignVehiclesToClient, getUnassignedVehicles } from "@/features/vehicle/actions";
import type { VehicleList } from "@/features/vehicle/queries";
import { VehicleRowsSkeleton } from "@/features/vehicle/components/vehicle-row";
import { useLoadedData } from "@/hooks/use-loaded-data";
import { DATE_FORMAT } from "@/lib/format/date";
import { formatDni } from "@/lib/format/dni";
import { formatPhone } from "@/lib/format/phone";
import { formatPlate } from "@/lib/format/plate";

import { createClient, setClientArchived, updateClient, type ClientActionResult } from "../actions";
import { formatClientName } from "../format";
import type { Client, ClientFormValues } from "../schemas";
import { AddVehicleChoice } from "./add-vehicle-choice";
import { AssignVehicles, type AssignOutcome } from "./assign-vehicles";
import { ClientForm } from "./client-form";
import { ClientVehicles } from "./client-vehicles";

// create / view / edit, and the two steps of "Agregar vehículo".
export type ClientModalMode = "view" | "edit" | "create" | "add-vehicle" | "assign";

const FORM_ID = "client-form";

type ClientModalProps = {
  open: boolean;
  mode: ClientModalMode;
  client: Client | null;
  onModeChange: (mode: ClientModalMode, client?: Client) => void;
  onOpenChange: (open: boolean) => void;
};

type ModalContent = Pick<
  DetailModalProps,
  "title" | "badge" | "subtitle" | "actions" | "createdOn" | "footer" | "onBack" | "children"
>;

function isUnchanged(values: ClientFormValues, client: Client): boolean {
  return (
    values.name === client.name &&
    values.surname === client.surname &&
    values.phoneNumber === client.phoneNumber &&
    values.dni === client.dni &&
    values.email === client.email
  );
}

export function ClientModal({ open, mode, client, onModeChange, onOpenChange }: ClientModalProps) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const [saving, setSaving] = useState(false);
  const [archiving, startArchiving] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);

  // The vehicles without a client load when "Agregar vehículo" opens and are
  // kept across its two steps; leaving the flow drops them.
  const adding = mode === "add-vehicle" || mode === "assign";
  const unassigned = useLoadedData<VehicleList | null>(adding ? "unassigned" : "idle", () =>
    adding ? getUnassignedVehicles() : Promise.resolve(null),
  );

  const showSaved = (saved: Client, toastKey: "created" | "updated") => {
    toast(t(`toasts.${toastKey}`), { description: formatClientName(saved) });
    onModeChange("view", saved);
  };

  const submit = async (values: ClientFormValues): Promise<ClientActionResult | void> => {
    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createClient(values);
        if (result.ok) showSaved(result.data, "created");
        return result;
      }
      if (!client) return;
      if (isUnchanged(values, client)) {
        onModeChange("view");
        return;
      }
      const result = await updateClient(client.id, values);
      if (result.ok) showSaved(result.data, "updated");
      return result;
    } finally {
      setSaving(false);
    }
  };

  const setArchived = (archived: boolean) => {
    if (!client) return;
    startArchiving(async () => {
      const result = await setClientArchived(client.id, archived);
      setConfirmArchive(false);
      if (!result.ok) {
        toast.error(tCommon("unexpectedError"));
        return;
      }
      toast(t(archived ? "toasts.archived" : "toasts.unarchived"), { description: formatClientName(result.data) });
      // Done with this client: the list refreshes behind the closing modal.
      onOpenChange(false);
    });
  };

  const assign = async (vehicleIds: string[]): Promise<AssignOutcome> => {
    if (!client) return "error";
    const result = await assignVehiclesToClient(client.id, vehicleIds);
    if (!result.ok) {
      if (result.error !== "alreadyAssigned") return "error";
      unassigned.retry();
      return "alreadyAssigned";
    }

    const { assigned, skipped } = result.data;
    const known = unassigned.status === "ready" && unassigned.data?.ok ? unassigned.data.rows : [];
    const single = assigned.length === 1 ? known.find((vehicle) => vehicle.id === assigned[0]) : undefined;
    if (single) toast(t("toasts.vehicleAssigned"), { description: formatPlate(single.plate) });
    else toast(t("toasts.vehiclesAssigned"), { description: t("toasts.vehiclesCount", { count: assigned.length }) });

    if (skipped > 0) {
      unassigned.retry();
      return "partial";
    }
    onModeChange("view");
    return "done";
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

  const notLoaded = <span className="text-muted-foreground">{t("notLoaded")}</span>;

  // One DetailModal for every mode, so switching modes doesn't reopen the dialog.
  let content: ModalContent;
  if (mode === "create") {
    content = {
      title: t("add"),
      subtitle: tCommon("requiredFields"),
      footer: formFooter(t("add"), () => onOpenChange(false)),
      children: <ClientForm key="create" id={FORM_ID} onSubmit={submit} />,
    };
  } else if (!client) {
    return null;
  } else if (mode === "add-vehicle") {
    content = {
      title: t("addVehicle.title"),
      subtitle: formatClientName(client),
      onBack: () => onModeChange("view"),
      children: <AddVehicleChoice unassigned={unassigned} onAssignExisting={() => onModeChange("assign")} />,
    };
  } else if (mode === "assign") {
    // While it reloads after a partial assignment, keep the step (and its
    // message) on the last list instead of swapping it for a skeleton.
    const source = unassigned.status === "ready" ? unassigned.data : unassigned.status === "loading" ? unassigned.previous : null;
    const list = source?.ok ? source.rows : null;
    content = {
      title: t("assign.title"),
      subtitle: formatClientName(client),
      onBack: () => onModeChange("add-vehicle"),
      children: list ? (
        <AssignVehicles vehicles={list} onSubmit={assign} />
      ) : unassigned.status === "loading" ? (
        <VehicleRowsSkeleton rows={5} />
      ) : (
        <ListError onRetry={unassigned.retry} />
      ),
    };
  } else if (mode === "edit") {
    content = {
      title: t("edit"),
      subtitle: (
        <>
          <span className="block font-medium text-foreground">{formatClientName(client)}</span>
          {tCommon("requiredFields")}
        </>
      ),
      footer: formFooter(t("save"), () => onModeChange("view")),
      children: (
        <ClientForm
          key={`edit-${client.id}`}
          id={FORM_ID}
          defaultValues={{
            name: client.name,
            surname: client.surname ?? "",
            phoneNumber: formatPhone(client.phoneNumber),
            dni: client.dni ?? "",
            email: client.email ?? "",
          }}
          onSubmit={submit}
        />
      ),
    };
  } else {
    content = {
      title: formatClientName(client),
      badge: client.enabled ? null : <ArchivedBadge />,
      actions: (
        <>
          {client.enabled ? (
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
      createdOn: format.dateTime(new Date(client.createdAt), DATE_FORMAT),
      children: (
        <>
          <DetailList
            items={[
              { label: t("fields.dni"), value: client.dni ? formatDni(client.dni) : notLoaded },
              {
                label: t("fields.phone"),
                value: (
                  <span className="inline-flex items-center gap-1">
                    {client.phoneNumber}
                    <WhatsappButton phone={client.phoneNumber} label={t("whatsapp")} text={t("whatsappText")} />
                  </span>
                ),
              },
              { label: t("fields.email"), value: client.email ?? notLoaded },
            ]}
          />
          <ClientVehicles key={client.id} clientId={client.id} onAddVehicle={() => onModeChange("add-vehicle")} />
        </>
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
    </>
  );
}
