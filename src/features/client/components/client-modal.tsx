"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { ArchiveConfirmDialog, ArchiveToggleButton } from "@/components/shared/archive-controls";
import { DetailList } from "@/components/shared/detail-list";
import { DetailModal, type DetailModalProps } from "@/components/shared/detail-modal";
import { ListError } from "@/components/shared/list-states";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { Button } from "@/components/ui/button";
import { assignVehiclesToClient, getUnassignedVehicles } from "@/features/vehicle/actions";
import { useVehicleModal } from "@/features/vehicle/components/use-vehicle-modal";
import type { VehicleList } from "@/features/vehicle/queries";
import { VehicleRowsSkeleton } from "@/features/vehicle/components/vehicle-row";
import type { VehicleListItem } from "@/features/vehicle/schemas";
import { useArchiveFlow } from "@/hooks/use-archive-flow";
import { useLoadedData } from "@/hooks/use-loaded-data";
import { fail } from "@/lib/actions/result";
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

// create / view / edit, the two steps of "Agregar vehículo", and a vehicle of the
// client (view, edit, or the creation of a new one) as one more step of the chain.
export type ClientModalMode =
  | "view"
  | "edit"
  | "create"
  | "add-vehicle"
  | "assign"
  | "vehicle-view"
  | "vehicle-edit"
  | "vehicle-create"
  | "vehicle-job-view"
  | "vehicle-job-edit";

const FORM_ID = "client-form";

type ClientModalProps = {
  open: boolean;
  mode: ClientModalMode;
  client: Client | null;
  // The vehicle of the vehicle-* modes, and the job of the vehicle-job-* ones.
  vehicle?: VehicleListItem | null;
  jobId?: string | null;
  onModeChange: (mode: ClientModalMode, client?: Client, vehicle?: VehicleListItem, jobId?: string) => void;
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

export function ClientModal({
  open,
  mode,
  client,
  vehicle = null,
  jobId = null,
  onModeChange,
  onOpenChange,
}: ClientModalProps) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const [saving, setSaving] = useState(false);
  // The vehicle the user came back from: its row gets the focus.
  const [focusVehicleId, setFocusVehicleId] = useState<string | null>(null);

  // The vehicles without a client load when "Agregar vehículo" opens and are
  // kept across its two steps; leaving the flow drops them.
  const adding = mode === "add-vehicle" || mode === "assign";
  const unassigned = useLoadedData<VehicleList | null>(adding ? "unassigned" : "idle", () =>
    adding ? getUnassignedVehicles() : Promise.resolve(null),
  );

  // Every action closes the modal and confirms with a toast (docs/design.md#modals).
  const showSaved = (saved: Client, toastKey: "created" | "updated") => {
    toast(t(`toasts.${toastKey}`), { description: formatClientName(saved) });
    onOpenChange(false);
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

  // Archive and unarchive: the standard flow, then the modal closes (docs/design.md#archive).
  const archiveFlow = useArchiveFlow({
    run: async (archived) => (client ? setClientArchived(client.id, archived) : fail("notFound")),
    notify: (archived, saved) => ({
      title: t(archived ? "toasts.archived" : "toasts.unarchived"),
      description: formatClientName(saved),
    }),
    onDone: () => onOpenChange(false),
    errorMessage: tCommon("unexpectedError"),
  });

  // A vehicle of this client is one more step of the chain: the same content the
  // Vehículos page shows, with "Volver" to here.
  const vehicleMode =
    mode === "vehicle-view"
      ? "view"
      : mode === "vehicle-edit"
        ? "edit"
        : mode === "vehicle-create"
          ? "create"
          : mode === "vehicle-job-view"
            ? "job-view"
            : mode === "vehicle-job-edit"
              ? "job-edit"
              : null;
  const vehicleModal = useVehicleModal({
    mode: vehicleMode ?? "view",
    vehicle: vehicleMode ? vehicle : null,
    jobId,
    onModeChange: (next, saved, nextJobId) => onModeChange(`vehicle-${next}`, undefined, saved, nextJobId),
    onClose: () => onOpenChange(false),
    fromClient: client
      ? {
          client: { id: client.id, name: formatClientName(client) },
          // Creating goes back to the choice; viewing, to the client.
          onBack:
            vehicleMode === "create"
              ? () => onModeChange("add-vehicle")
              : () => {
                  setFocusVehicleId(vehicle?.id ?? null);
                  onModeChange("view");
                },
        }
      : undefined,
  });

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

    // Some were taken meanwhile: the step stays open to say so. Otherwise it's done.
    if (skipped > 0) {
      unassigned.retry();
      return "partial";
    }
    onOpenChange(false);
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
  } else if (vehicleMode) {
    if (!vehicleModal.content) return null;
    content = vehicleModal.content;
  } else if (mode === "add-vehicle") {
    content = {
      title: t("addVehicle.title"),
      subtitle: formatClientName(client),
      onBack: () => onModeChange("view"),
      children: (
        <AddVehicleChoice
          unassigned={unassigned}
          onAssignExisting={() => onModeChange("assign")}
          onCreateNew={() => onModeChange("vehicle-create")}
        />
      ),
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
          <ArchiveToggleButton archived={!client.enabled} flow={archiveFlow} />
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
                    <WhatsappButton phone={client.phoneNumber} label={tCommon("whatsapp")} text={tCommon("whatsappText")} />
                  </span>
                ),
              },
              { label: t("fields.email"), value: client.email ?? notLoaded },
            ]}
          />
          <ClientVehicles
            key={client.id}
            clientId={client.id}
            focusVehicleId={focusVehicleId}
            onAddVehicle={() => {
              setFocusVehicleId(null);
              onModeChange("add-vehicle");
            }}
            onOpenVehicle={(opened) => {
              setFocusVehicleId(null);
              onModeChange("vehicle-view", undefined, opened);
            }}
          />
        </>
      ),
    };
  }

  return (
    <>
      <DetailModal open={open} onOpenChange={onOpenChange} {...content} />
      <ArchiveConfirmDialog flow={archiveFlow} title={t("archiveConfirm.title")} detail={t("archiveConfirm.body")} />
      {vehicleModal.confirmDialog}
    </>
  );
}
