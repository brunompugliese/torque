"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { ArchiveConfirmDialog, ArchiveToggleButton } from "@/components/shared/archive-controls";
import { DetailList } from "@/components/shared/detail-list";
import type { DetailModalProps } from "@/components/shared/detail-modal";
import { PlateDisplay } from "@/components/shared/plate-display";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { Button } from "@/components/ui/button";
import { formatClientName } from "@/features/client/format";
import { VehicleJobs } from "@/features/job/components/vehicle-jobs";
import { useArchiveFlow } from "@/hooks/use-archive-flow";
import { fail } from "@/lib/actions/result";
import { DATE_FORMAT } from "@/lib/format/date";
import { formatKm } from "@/lib/format/km";
import { formatPlate } from "@/lib/format/plate";

import { createVehicle, setVehicleArchived, updateVehicle, type VehicleActionResult } from "../actions";
import type { VehicleFormValues, VehicleListItem } from "../schemas";
import { VehicleForm } from "./vehicle-form";

export type VehicleModalMode = "view" | "edit" | "create";

// When the vehicle modal is a step inside the client modal (client → vehicle).
export type VehicleFromClient = {
  client: { id: string; name: string };
  // "Volver" in the vehicle, and "Cancelar" in the creation form, go one step back.
  onBack: () => void;
};

type UseVehicleModalOptions = {
  mode: VehicleModalMode;
  vehicle: VehicleListItem | null;
  onModeChange: (mode: VehicleModalMode, vehicle?: VehicleListItem) => void;
  // Closes the whole modal (the X, and after archiving).
  onClose: () => void;
  fromClient?: VehicleFromClient;
};

export type VehicleModalContent = Pick<
  DetailModalProps,
  "title" | "badge" | "subtitle" | "actions" | "createdOn" | "footer" | "onBack" | "children"
>;

const FORM_ID = "vehicle-form";

function isUnchanged(values: VehicleFormValues, vehicle: VehicleListItem): boolean {
  return (
    values.plate === vehicle.plate &&
    values.brandId === vehicle.brandId &&
    values.modelId === vehicle.modelId &&
    values.year === vehicle.year &&
    values.vin === vehicle.vin &&
    values.clientId === (vehicle.client?.id ?? null) &&
    values.newClient === null
  );
}

// What a vehicle modal shows, for the Vehículos page and for the client modal
// (which hosts it as a step). The host renders `content` in its DetailModal and
// `confirmDialog` beside it. `content` is null when there is nothing to show.
export function useVehicleModal({
  mode,
  vehicle,
  onModeChange,
  onClose,
  fromClient,
}: UseVehicleModalOptions): { content: VehicleModalContent | null; confirmDialog: ReactNode } {
  const t = useTranslations("vehicles");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [saving, setSaving] = useState(false);

  const archiveFlow = useArchiveFlow({
    run: async (archived) => (vehicle ? setVehicleArchived(vehicle.id, archived) : fail("notFound")),
    notify: (archived, saved) => ({
      title: t(archived ? "toasts.archived" : "toasts.unarchived"),
      description: formatPlate(saved.plate),
    }),
    onDone: onClose,
    errorMessage: tCommon("unexpectedError"),
  });

  const confirmDialog = (
    <ArchiveConfirmDialog flow={archiveFlow} title={t("archiveConfirm.title")} detail={t("archiveConfirm.body")} />
  );

  const submit = async (values: VehicleFormValues): Promise<VehicleActionResult | void> => {
    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createVehicle(values);
        if (!result.ok) return result;
        toast(t(values.newClient ? "toasts.createdWithClient" : "toasts.created"), {
          description: formatPlate(result.data.plate),
        });
        // Every action closes the modal, the whole chain when it is a step of the client's.
        onClose();
        return result;
      }
      if (!vehicle) return;
      if (isUnchanged(values, vehicle)) {
        onModeChange("view");
        return;
      }
      const result = await updateVehicle(vehicle.id, values);
      if (result.ok) {
        toast(t("toasts.updated"), { description: formatPlate(result.data.plate) });
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
        title: t("add"),
        subtitle: tCommon("requiredFields"),
        // Cancelar closes, or goes back to the step that opened the form.
        footer: formFooter(t("add"), fromClient ? fromClient.onBack : onClose),
        children: <VehicleForm key="create" id={FORM_ID} lockedClient={fromClient?.client} onSubmit={submit} />,
      },
    };
  }

  if (!vehicle) return { content: null, confirmDialog };

  if (mode === "edit") {
    return {
      confirmDialog,
      content: {
        title: t("edit"),
        subtitle: (
          <>
            <span className="block font-medium text-foreground">{formatPlate(vehicle.plate)}</span>
            {tCommon("requiredFields")}
          </>
        ),
        footer: formFooter(t("save"), () => onModeChange("view")),
        children: <VehicleForm key={`edit-${vehicle.id}`} id={FORM_ID} vehicle={vehicle} onSubmit={submit} />,
      },
    };
  }

  const notLoaded = <span className="text-muted-foreground">{t("notLoaded")}</span>;
  const { client } = vehicle;
  const details = [vehicle.brandName, vehicle.modelName, vehicle.year].filter((part) => part !== null).join(" ");

  return {
    confirmDialog,
    content: {
      title: (
        <span className="flex flex-wrap items-center gap-3">
          <PlateDisplay plate={vehicle.plate} />
          <span>{details}</span>
        </span>
      ),
      badge: vehicle.enabled ? null : <ArchivedBadge />,
      actions: (
        <>
          <ArchiveToggleButton archived={!vehicle.enabled} flow={archiveFlow} />
          <Button onClick={() => onModeChange("edit")}>{t("edit")}</Button>
        </>
      ),
      createdOn: format.dateTime(new Date(vehicle.createdAt), DATE_FORMAT),
      onBack: fromClient?.onBack,
      children: (
        <>
          <DetailList
            items={[
              {
                label: t("details.client"),
                value: client ? (
                  <span className="flex flex-col gap-1">
                    <span>{client.enabled ? formatClientName(client) : t("clientArchived", { name: formatClientName(client) })}</span>
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
              { label: t("details.vin"), value: vehicle.vin ?? notLoaded },
              { label: t("details.lastKm"), value: vehicle.lastKm === null ? notLoaded : formatKm(vehicle.lastKm) },
            ]}
          />
          <VehicleJobs key={vehicle.id} vehicleId={vehicle.id} />
        </>
      ),
    },
  };
}
