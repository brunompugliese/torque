"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { JobListItem } from "../schemas";
import type { JobModalMode } from "./use-job-modal";

// The modal (form, validation, services editor) is its own chunk: the list doesn't wait for it.
const loadJobModal = () => import("./job-modal").then((module) => module.JobModal);
const JobModal = dynamic(loadJobModal);

type JobsPanelContext = {
  openJob: (job: JobListItem) => void;
  openCreate: () => void;
};

const PanelContext = createContext<JobsPanelContext | null>(null);

export function useJobsPanel(): JobsPanelContext {
  const context = useContext(PanelContext);
  if (!context) throw new Error("useJobsPanel must be used inside JobsPanel");
  return context;
}

type ModalState = { open: boolean; mode: JobModalMode; job: JobListItem | null };

// The modal opens from the loaded row: no request per click.
export function JobsPanel({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ open: false, mode: "view", job: null });

  const openJob = useCallback((job: JobListItem) => setModal({ open: true, mode: "view", job }), []);
  const openCreate = useCallback(() => setModal({ open: true, mode: "create", job: null }), []);

  // Fetched once the page is interactive, so the first click doesn't wait.
  useEffect(() => {
    void loadJobModal();
  }, []);

  const value = useMemo(() => ({ openJob, openCreate }), [openJob, openCreate]);

  return (
    <PanelContext.Provider value={value}>
      {children}
      {/* Mounted from the first open on, so it can animate closed. */}
      {modal.job || modal.mode === "create" ? (
        <JobModal
          open={modal.open}
          mode={modal.mode}
          job={modal.job}
          onModeChange={(mode, job) => setModal((current) => ({ ...current, mode, job: job ?? current.job }))}
          onOpenChange={(open) => setModal((current) => ({ ...current, open }))}
        />
      ) : null}
    </PanelContext.Provider>
  );
}
