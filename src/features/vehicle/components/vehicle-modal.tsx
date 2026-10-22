"use client";

import { DetailModal } from "@/components/shared/detail-modal";

import type { VehicleListItem } from "../schemas";
import { useVehicleModal, type VehicleModalMode } from "./use-vehicle-modal";

type VehicleModalProps = {
  open: boolean;
  mode: VehicleModalMode;
  vehicle: VehicleListItem | null;
  onModeChange: (mode: VehicleModalMode, vehicle?: VehicleListItem) => void;
  onOpenChange: (open: boolean) => void;
};

// The vehicle modal of the Vehículos page: one DetailModal for view, edit and
// create, so switching modes doesn't reopen the dialog.
export function VehicleModal({ open, mode, vehicle, onModeChange, onOpenChange }: VehicleModalProps) {
  const { content, confirmDialog } = useVehicleModal({
    mode,
    vehicle,
    onModeChange,
    onClose: () => onOpenChange(false),
  });
  if (!content) return null;

  return (
    <>
      <DetailModal open={open} onOpenChange={onOpenChange} {...content} />
      {confirmDialog}
    </>
  );
}
