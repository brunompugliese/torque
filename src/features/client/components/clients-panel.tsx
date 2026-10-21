"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Client } from "../schemas";
import type { ClientModalMode } from "./client-modal";

// The modal (form, validation) is its own chunk: the list doesn't wait for it.
const loadClientModal = () => import("./client-modal").then((module) => module.ClientModal);
const ClientModal = dynamic(loadClientModal);

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

  // Fetched once the page is interactive, so the first click doesn't wait.
  useEffect(() => {
    void loadClientModal();
  }, []);

  const value = useMemo(() => ({ openClient, openCreate }), [openClient, openCreate]);

  return (
    <PanelContext.Provider value={value}>
      {children}
      {/* Mounted from the first open on, so it can animate closed. */}
      {modal.client || modal.mode === "create" ? (
        <ClientModal
          open={modal.open}
          mode={modal.mode}
          client={modal.client}
          onModeChange={(mode, client) => setModal((current) => ({ ...current, mode, client: client ?? current.client }))}
          onOpenChange={(open) => setModal((current) => ({ ...current, open }))}
        />
      ) : null}
    </PanelContext.Provider>
  );
}
