"use client";

import dynamic from "next/dynamic";
import { ModalBoundary } from "@/components/shared/modal-boundary";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { todayIsoDate } from "@/lib/calendar";

import type { AppointmentListItem } from "../schemas";
import type { AppointmentModalMode } from "./use-appointment-modal";

// The modal (form, validation, job step) is its own chunk: the calendar doesn't wait for it.
const loadAppointmentModal = () => import("./appointment-modal").then((module) => module.AppointmentModal);
const AppointmentModal = dynamic(loadAppointmentModal);

// What the panel tells the calendar: it moves to a saved day, or reopens the "+N más" list a modal was
// opened from. `nonce` orders them: the calendar applies every one it hasn't seen, in order.
export type CalendarMessage =
  | { type: "saved"; date: string }
  | { type: "reopen-day"; day: string; itemId: string };

export type CalendarSignal = CalendarMessage & { nonce: number };

type AppointmentsPanelContext = {
  // `fromDay`: the day whose "+N más" list the appointment was opened from.
  openAppointment: (appointment: AppointmentListItem, fromDay?: string) => void;
  openCreate: (date?: string) => void;
  signals: readonly CalendarSignal[];
};

const PanelContext = createContext<AppointmentsPanelContext | null>(null);

export function useAppointmentsPanel(): AppointmentsPanelContext {
  const context = useContext(PanelContext);
  if (!context) throw new Error("useAppointmentsPanel must be used inside AppointmentsPanel");
  return context;
}

type ModalState = {
  open: boolean;
  mode: AppointmentModalMode;
  appointment: AppointmentListItem | null;
  jobId: string | null;
  createDate: string;
  fromDay: string | null;
};

const CLOSED: ModalState = {
  open: false,
  mode: "view",
  appointment: null,
  jobId: null,
  createDate: "",
  fromDay: null,
};

// Holds the appointment modal for the whole page, so the "Nuevo turno" button and the calendar open
// the same one. The modal opens from the row already loaded: no request per click.
export function AppointmentsPanel({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(CLOSED);
  const [signals, setSignals] = useState<readonly CalendarSignal[]>([]);
  const nonce = useRef(0);
  // The "+N más" list to open again once the modal has fully closed: opening it while the modal's
  // exit animation still runs leaves the list inert (the modal is still holding the page).
  const reopen = useRef<{ day: string; itemId: string } | null>(null);

  const send = useCallback((message: CalendarMessage) => {
    nonce.current += 1;
    const signal = { ...message, nonce: nonce.current };
    setSignals((current) => [...current, signal]);
  }, []);

  const openAppointment = useCallback(
    (appointment: AppointmentListItem, fromDay?: string) => {
      reopen.current = null;
      setModal({ ...CLOSED, open: true, appointment, fromDay: fromDay ?? null });
    },
    [],
  );
  const openCreate = useCallback((date?: string) => {
    reopen.current = null;
    setModal({ ...CLOSED, open: true, mode: "create", createDate: date ?? todayIsoDate() });
  }, []);

  // Fetched once the page is interactive, so the first click doesn't wait.
  useEffect(() => {
    void loadAppointmentModal();
  }, []);

  const value = useMemo(() => ({ openAppointment, openCreate, signals }), [openAppointment, openCreate, signals]);

  // The X, and after any action: the whole modal goes. One opened from a day's "+N más" list leaves
  // that list open again, as it was.
  const close = () => {
    if (modal.fromDay && modal.appointment) reopen.current = { day: modal.fromDay, itemId: modal.appointment.id };
    setModal((current) => ({ ...current, open: false }));
  };

  const closed = () => {
    const pending = reopen.current;
    reopen.current = null;
    if (pending) send({ type: "reopen-day", ...pending });
  };

  return (
    <PanelContext.Provider value={value}>
      {children}
      {/* Mounted from the first open on, so it can animate closed. */}
      {modal.appointment || modal.mode === "create" ? (
        <ModalBoundary>
          <AppointmentModal
            open={modal.open}
            mode={modal.mode}
            appointment={modal.appointment}
            jobId={modal.jobId}
            createDate={modal.createDate}
            onModeChange={(mode, jobId) => setModal((current) => ({ ...current, mode, jobId: jobId ?? null }))}
            onClose={close}
            onClosed={closed}
            onSaved={(saved) => send({ type: "saved", date: saved.date })}
          />
        </ModalBoundary>
      ) : null}
    </PanelContext.Provider>
  );
}
