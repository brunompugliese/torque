"use client";

import { DetailModal } from "@/components/shared/detail-modal";

import type { AppointmentListItem } from "../schemas";
import { useAppointmentModal, type AppointmentModalMode } from "./use-appointment-modal";

type AppointmentModalProps = {
  open: boolean;
  mode: AppointmentModalMode;
  appointment: AppointmentListItem | null;
  jobId: string | null;
  createDate: string;
  onModeChange: (mode: AppointmentModalMode, jobId?: string) => void;
  onClose: () => void;
  onSaved: (saved: AppointmentListItem) => void;
  // The modal has fully closed.
  onClosed: () => void;
};

// The appointment modal of the Turnos page: one DetailModal for view, edit, create and the job
// step, so switching modes doesn't reopen the dialog.
export function AppointmentModal({
  open,
  mode,
  appointment,
  jobId,
  createDate,
  onModeChange,
  onClose,
  onSaved,
  onClosed,
}: AppointmentModalProps) {
  const { content, confirmDialog } = useAppointmentModal({
    mode,
    appointment,
    createDate,
    jobId,
    onModeChange,
    onClose,
    onSaved,
  });
  if (!content) return null;

  return (
    <>
      <DetailModal
        open={open}
        onOpenChange={(next) => (next ? undefined : onClose())}
        onClosed={onClosed}
        {...content}
      />
      {confirmDialog}
    </>
  );
}
