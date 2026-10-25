"use client";

import { CaretRightIcon, PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { ListError } from "@/components/shared/list-states";
import { Button } from "@/components/ui/button";
import { VehicleRow, VehicleRowsSkeleton } from "@/features/vehicle/components/vehicle-row";
import { getClientVehicles } from "@/features/vehicle/actions";
import type { VehicleListItem } from "@/features/vehicle/schemas";
import { useLoadedData } from "@/hooks/use-loaded-data";

type ClientVehiclesProps = {
  clientId: string;
  onAddVehicle: () => void;
  onOpenVehicle: (vehicle: VehicleListItem) => void;
  // The vehicle the user just came back from: its row gets the focus.
  focusVehicleId?: string | null;
};

// The client's vehicles, loaded when the modal shows them. Each row opens the
// vehicle (with "Volver" back here).
export function ClientVehicles({ clientId, onAddVehicle, onOpenVehicle, focusVehicleId }: ClientVehiclesProps) {
  const t = useTranslations("clients.vehicles");
  const vehicles = useLoadedData(clientId, () => getClientVehicles(clientId));

  let body;
  if (vehicles.status === "loading") {
    body = <VehicleRowsSkeleton />;
  } else if (vehicles.status === "error" || !vehicles.data.ok) {
    body = <ListError onRetry={vehicles.retry} />;
  } else if (vehicles.data.rows.length === 0) {
    body = <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  } else {
    body = (
      <ul className="flex flex-col divide-y rounded-lg border">
        {vehicles.data.rows.map((vehicle) => (
          <li key={vehicle.id}>
            <button
              type="button"
              onClick={() => onOpenVehicle(vehicle)}
              ref={(button) => {
                if (button && vehicle.id === focusVehicleId) button.focus();
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors outline-none first:rounded-t-lg last:rounded-b-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <VehicleRow vehicle={vehicle} className="flex-1" />
              <CaretRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="client-vehicles-title" className="mt-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="client-vehicles-title" className="text-base font-semibold">
          {t("title")}
        </h3>
        <Button variant="outline" size="sm" onClick={onAddVehicle}>
          <PlusIcon aria-hidden="true" />
          {t("add")}
        </Button>
      </div>
      {body}
    </section>
  );
}
