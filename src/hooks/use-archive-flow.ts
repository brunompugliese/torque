"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/actions/result";

// The archive standard every archivable entity follows (docs/design.md#archive):
// archiving asks first, unarchiving doesn't; on success a toast confirms and the
// detail modal closes; on failure the modal stays open with an error toast.
export type ArchiveFlow = {
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  pending: boolean;
  // Opens the confirmation (archiving).
  askToArchive: () => void;
  // Runs the action: after the confirmation, or directly to unarchive.
  archive: () => void;
  unarchive: () => void;
};

type ArchiveFlowOptions<Data> = {
  run: (archived: boolean) => Promise<ActionResult<Data>>;
  // The toast: title ("Cliente archivado") and its second line (the name).
  notify: (archived: boolean, data: Data) => { title: string; description: string };
  // Closes the modal.
  onDone: () => void;
  errorMessage: string;
};

export function useArchiveFlow<Data>({ run, notify, onDone, errorMessage }: ArchiveFlowOptions<Data>): ArchiveFlow {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (archived: boolean) =>
    startTransition(async () => {
      const result = await run(archived);
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(errorMessage);
        return;
      }
      const { title, description } = notify(archived, result.data);
      toast(title, { description });
      onDone();
    });

  return {
    confirmOpen,
    setConfirmOpen,
    pending,
    askToArchive: () => setConfirmOpen(true),
    archive: () => submit(true),
    unarchive: () => submit(false),
  };
}
