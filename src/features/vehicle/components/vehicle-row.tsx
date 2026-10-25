import { useTranslations } from "next-intl";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { LoadingRegion } from "@/components/shared/loading-region";
import { PLATE_WIDTH_CLASS, PlateDisplay } from "@/components/shared/plate-display";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { Vehicle } from "../schemas";

type VehicleRowProps = {
  vehicle: Vehicle;
  className?: string;
};

// A vehicle on one line wherever a record lists its vehicles: plate drawing,
// brand + model, then year and VIN in secondary color.
export function VehicleRow({ vehicle, className }: VehicleRowProps) {
  const t = useTranslations("vehicles");
  const details = [vehicle.year, vehicle.vin ?? t("noVin")].filter((part) => part !== null).join(" · ");

  return (
    <div className={cn("flex min-w-0 items-center gap-3", !vehicle.enabled && "opacity-60", className)}>
      <PlateDisplay plate={vehicle.plate} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {vehicle.brandName} {vehicle.modelName}
        </span>
        <span className="truncate text-xs text-muted-foreground">{details}</span>
      </div>
      {vehicle.enabled ? null : <ArchivedBadge />}
    </div>
  );
}

export function VehicleRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <LoadingRegion>
      <div className="flex flex-col divide-y rounded-lg border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton data-testid="skeleton-block" className={cn("h-8 shrink-0", PLATE_WIDTH_CLASS)} />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton data-testid="skeleton-block" className="h-3.5 w-2/5" />
              <Skeleton data-testid="skeleton-block" className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
