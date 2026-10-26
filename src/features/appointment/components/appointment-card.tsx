"use client";

import { useTranslations } from "next-intl";

import { formatPlate } from "@/lib/format/plate";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

import type { AppointmentListItem } from "../schemas";

// Calendar cards (docs/design.md#visual-identity). Pendiente is a white card with a 4px edge in its
// color; Confirmado a solid border with diagonal lines over white; Completado a filled card with the
// edge; Cancelado a filled card with the edge, struck through. Tailwind needs whole class names, so
// each status spells its tokens out.
const CARD_CLASS: Record<AppointmentStatus, string> = {
  pendiente: "border border-l-4 border-border border-l-status-pending-dot bg-card text-foreground",
  confirmado: "border border-status-done-dot hatch-done bg-card text-foreground",
  completado:
    "border border-l-4 border-status-done-border border-l-status-done-dot bg-status-done text-status-done-foreground",
  cancelado:
    "border border-l-4 border-status-cancelled-border border-l-status-cancelled-dot bg-status-cancelled text-status-cancelled-foreground line-through",
};

// The legend's squares say the same thing as the cards: a plain square for Pendiente and Cancelado,
// the hatch for Confirmado and the card's own solid fill and border for Completado.
const SQUARE_CLASS: Record<AppointmentStatus, string> = {
  pendiente: "border-status-pending-dot bg-status-pending-dot",
  confirmado: "border-status-done-dot hatch-done",
  completado: "border-status-done-dot bg-status-done",
  cancelado: "border-status-cancelled-dot bg-status-cancelled-dot",
};

type AppointmentCardProps = {
  appointment: Pick<AppointmentListItem, "id" | "time" | "status" | "vehicle">;
  onOpen: () => void;
  // "line": one line in a month day. "list": the "+N más" list, which also names the plate.
  variant?: "line" | "list";
};

// An appointment in the calendar: the time in bold and the model, as a button that opens it. The
// accessible name carries the status, because the color alone is not enough.
export function AppointmentCard({ appointment, onOpen, variant = "line" }: AppointmentCardProps) {
  const t = useTranslations("appointments");
  const tStatus = useTranslations("status.appointment");
  const { time, status, vehicle } = appointment;
  const plate = formatPlate(vehicle.plate);
  const name = `${vehicle.brandName} ${vehicle.modelName}`;

  return (
    <button
      type="button"
      data-item-id={appointment.id}
      data-status={status}
      aria-label={
        variant === "list"
          ? t("cardWithPlate", { time, model: name, plate, status: tStatus(status) })
          : t("card", { time, model: name, status: tStatus(status) })
      }
      onClick={onOpen}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        CARD_CLASS[status],
      )}
    >
      <span className="font-bold tabular-nums">{time}</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {variant === "list" ? <span className="shrink-0 tabular-nums">{plate}</span> : null}
    </button>
  );
}

// Under the calendar: what each edge color means.
export function AppointmentLegend() {
  const t = useTranslations("appointments");
  const tStatus = useTranslations("status.appointment");

  return (
    <ul aria-label={t("legend")} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {APPOINTMENT_STATUSES.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-[3px] border", SQUARE_CLASS[status])} />
          {tStatus(status)}
        </li>
      ))}
    </ul>
  );
}
