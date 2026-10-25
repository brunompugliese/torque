"use client";

import dynamic from "next/dynamic";
import { ModalBoundary } from "@/components/shared/modal-boundary";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { VehicleListItem } from "../schemas";
import type { VehicleModalMode } from "./use-vehicle-modal";

// The modal (form, validation, job history) is its own chunk: the list doesn't wait for it.
const loadVehicleModal = () => import("./vehicle-modal").then((module) => module.VehicleModal);
const VehicleModal = dynamic(loadVehicleModal);

type VehiclesPanelContext = {
  openVehicle: (vehicle: VehicleListItem) => void;
  openCreate: () => void;
};

const PanelContext = createContext<VehiclesPanelContext | null>(null);

export function useVehiclesPanel(): VehiclesPanelContext {
  const context = useContext(PanelContext);
  if (!context) throw new Error("useVehiclesPanel must be used inside VehiclesPanel");
  return context;
}

type ModalState = { open: boolean; mode: VehicleModalMode; vehicle: VehicleListItem | null; jobId: string | null };

// The modal opens from the loaded row: no request per click.
export function VehiclesPanel({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ open: false, mode: "view", vehicle: null, jobId: null });

  const openVehicle = useCallback((vehicle: VehicleListItem) => setModal({ open: true, mode: "view", vehicle, jobId: null }), []);
  const openCreate = useCallback(() => setModal({ open: true, mode: "create", vehicle: null, jobId: null }), []);

  // Fetched once the page is interactive, so the first click doesn't wait.
  useEffect(() => {
    void loadVehicleModal();
  }, []);

  const value = useMemo(() => ({ openVehicle, openCreate }), [openVehicle, openCreate]);

  return (
    <PanelContext.Provider value={value}>
      {children}
      {/* Mounted from the first open on, so it can animate closed. */}
      {modal.vehicle || modal.mode === "create" ? (
        <ModalBoundary>
          <VehicleModal
            open={modal.open}
            mode={modal.mode}
            vehicle={modal.vehicle}
            jobId={modal.jobId}
            onModeChange={(mode, vehicle, jobId) =>
              setModal((current) => ({
                ...current,
                mode,
                vehicle: vehicle ?? current.vehicle,
                jobId: jobId ?? current.jobId,
              }))
            }
            onOpenChange={(open) => setModal((current) => ({ ...current, open }))}
          />
        </ModalBoundary>
      ) : null}
    </PanelContext.Provider>
  );
}
