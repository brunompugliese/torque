"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Service } from "../schemas";
import type { ServiceModalMode } from "./service-modal";

// The modal (form, validation) is its own chunk: the list doesn't wait for it.
const loadServiceModal = () => import("./service-modal").then((module) => module.ServiceModal);
const ServiceModal = dynamic(loadServiceModal);

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

  // Fetched once the page is interactive, so the first click doesn't wait.
  useEffect(() => {
    void loadServiceModal();
  }, []);

  const value = useMemo(() => ({ openService, openCreate }), [openService, openCreate]);

  return (
    <PanelContext.Provider value={value}>
      {children}
      {/* Mounted from the first open on, so it can animate closed. */}
      {modal.service || modal.mode === "create" ? (
        <ServiceModal
          open={modal.open}
          mode={modal.mode}
          service={modal.service}
          onModeChange={(mode, service) => setModal((current) => ({ ...current, mode, service: service ?? current.service }))}
          onOpenChange={(open) => setModal((current) => ({ ...current, open }))}
        />
      ) : null}
    </PanelContext.Provider>
  );
}
