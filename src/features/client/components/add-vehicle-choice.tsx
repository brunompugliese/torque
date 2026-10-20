"use client";

import { CaretRightIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ListError } from "@/components/shared/list-states";
import { LoadingRegion } from "@/components/shared/loading-region";
import { Skeleton } from "@/components/ui/skeleton";
import type { VehicleList } from "@/features/vehicle/queries";
import type { LoadedData } from "@/hooks/use-loaded-data";

type AddVehicleChoiceProps = {
  unassigned: LoadedData<VehicleList | null>;
  onAssignExisting: () => void;
};

function ChoiceRow({
  title,
  subtitle,
  disabled,
  onClick,
}: {
  title: string;
  subtitle: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-4 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <CaretRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

// First step of "Agregar vehículo": two flows, never shown together.
export function AddVehicleChoice({ unassigned, onAssignExisting }: AddVehicleChoiceProps) {
  const t = useTranslations("clients.addVehicle");

  if (unassigned.status === "loading") {
    return (
      <LoadingRegion>
        <div className="flex flex-col gap-3">
          {[0, 1].map((row) => (
            <div key={row} className="flex flex-col gap-1.5 rounded-xl border px-4 py-4">
              <Skeleton data-testid="skeleton-block" className="h-4 w-2/5" />
              <Skeleton data-testid="skeleton-block" className="h-3 w-1/4" />
            </div>
          ))}
        </div>
      </LoadingRegion>
    );
  }
  if (unassigned.status === "error" || !unassigned.data?.ok) return <ListError onRetry={unassigned.retry} />;

  const none = unassigned.data.rows.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <ChoiceRow
        title={t("assignTitle")}
        subtitle={none ? t("assignNone") : t("assignSubtitle")}
        disabled={none}
        onClick={onAssignExisting}
      />
      <ChoiceRow title={t("createTitle")} subtitle={t("createSoon")} disabled />
    </div>
  );
}
