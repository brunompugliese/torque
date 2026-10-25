"use client";

import { DetailModal } from "@/components/shared/detail-modal";

import type { VehicleListItem } from "../schemas";
import { useVehicleModal, type VehicleModalMode } from "./use-vehicle-modal";

type VehicleModalProps = {
  open: boolean;
  mode: VehicleModalMode;
  vehicle: VehicleListItem | null;
  // The job of the job-* modes.
  jobId?: string | null;
  onModeChange: (mode: VehicleModalMode, vehicle?: VehicleListItem, jobId?: string) => void;
  onOpenChange: (open: boolean) => void;
};

// The vehicle modal of the Vehículos page: one DetailModal for view, edit and
// create, so switching modes doesn't reopen the dialog.
export function VehicleModal({ open, mode, vehicle, jobId, onModeChange, onOpenChange }: VehicleModalProps) {
  const { content, confirmDialog } = useVehicleModal({
    mode,
    vehicle,
    jobId,
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
