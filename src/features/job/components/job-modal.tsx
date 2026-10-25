"use client";

import { DetailModal } from "@/components/shared/detail-modal";

import type { JobListItem } from "../schemas";
import { useJobModal, type JobModalMode } from "./use-job-modal";

type JobModalProps = {
  open: boolean;
  mode: JobModalMode;
  job: JobListItem | null;
  onModeChange: (mode: JobModalMode, job?: JobListItem) => void;
  onOpenChange: (open: boolean) => void;
};

// The job modal of the Trabajos page: one DetailModal for view, edit and create, so
// switching modes doesn't reopen the dialog.
export function JobModal({ open, mode, job, onModeChange, onOpenChange }: JobModalProps) {
  const { content, confirmDialog } = useJobModal({
    mode,
    job,
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
