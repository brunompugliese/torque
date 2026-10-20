"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { ListError } from "@/components/shared/list-states";
import { Button } from "@/components/ui/button";
import { VehicleRow, VehicleRowsSkeleton } from "@/features/vehicle/components/vehicle-row";
import { getClientVehicles } from "@/features/vehicle/actions";
import type { VehicleList } from "@/features/vehicle/queries";
import { useLoadedData } from "@/hooks/use-loaded-data";

type ClientVehiclesProps = {
  clientId: string;
  onAddVehicle: () => void;
};

function loadVehicles(clientId: string): Promise<VehicleList> {
  return getClientVehicles(clientId);
}

// The client's vehicles, loaded when the modal shows them. Rows aren't
// clickable until the Vehículos page exists.
export function ClientVehicles({ clientId, onAddVehicle }: ClientVehiclesProps) {
  const t = useTranslations("clients.vehicles");
  const vehicles = useLoadedData(clientId, () => loadVehicles(clientId));

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
          <li key={vehicle.id} className="px-3 py-2.5">
            <VehicleRow vehicle={vehicle} />
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
