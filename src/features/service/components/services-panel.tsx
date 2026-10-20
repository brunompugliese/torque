"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { Service } from "../schemas";
import { ServiceModal, type ServiceModalMode } from "./service-modal";

type ServicesPanelContext = {
  openService: (service: Service) => void;
  openCreate: () => void;
};

const PanelContext = createContext<ServicesPanelContext | null>(null);

export function useServicesPanel(): ServicesPanelContext {
  const context = useContext(PanelContext);
  if (!context) throw new Error("useServicesPanel must be used inside ServicesPanel");
  return context;
}

type ModalState = { open: boolean; mode: ServiceModalMode; service: Service | null };

// The modal opens from the loaded row: no request per click.
export function ServicesPanel({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ open: false, mode: "view", service: null });

  const openService = useCallback((service: Service) => setModal({ open: true, mode: "view", service }), []);
  const openCreate = useCallback(() => setModal({ open: true, mode: "create", service: null }), []);
  const value = useMemo(() => ({ openService, openCreate }), [openService, openCreate]);

  return (
    <PanelContext.Provider value={value}>
      {children}
      <ServiceModal
        open={modal.open}
        mode={modal.mode}
        service={modal.service}
        onModeChange={(mode, service) => setModal((current) => ({ ...current, mode, service: service ?? current.service }))}
        onOpenChange={(open) => setModal((current) => ({ ...current, open }))}
      />
    </PanelContext.Provider>
  );
}
