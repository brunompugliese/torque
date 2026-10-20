"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { Client } from "../schemas";
import { ClientModal, type ClientModalMode } from "./client-modal";

type ClientsPanelContext = {
  openClient: (client: Client) => void;
  openCreate: () => void;
};

const PanelContext = createContext<ClientsPanelContext | null>(null);

export function useClientsPanel(): ClientsPanelContext {
  const context = useContext(PanelContext);
  if (!context) throw new Error("useClientsPanel must be used inside ClientsPanel");
  return context;
}

type ModalState = { open: boolean; mode: ClientModalMode; client: Client | null };

// The modal opens from the loaded row: no request per click.
export function ClientsPanel({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ open: false, mode: "view", client: null });

  const openClient = useCallback((client: Client) => setModal({ open: true, mode: "view", client }), []);
  const openCreate = useCallback(() => setModal({ open: true, mode: "create", client: null }), []);
  const value = useMemo(() => ({ openClient, openCreate }), [openClient, openCreate]);

  return (
    <PanelContext.Provider value={value}>
      {children}
      <ClientModal
        open={modal.open}
        mode={modal.mode}
        client={modal.client}
        onModeChange={(mode, client) => setModal((current) => ({ ...current, mode, client: client ?? current.client }))}
        onOpenChange={(open) => setModal((current) => ({ ...current, open }))}
      />
    </PanelContext.Provider>
  );
}
