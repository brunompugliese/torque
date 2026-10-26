import type { AppointmentStatus } from "@/lib/status";

// The toast's text key under `appointments.toasts` for the status an appointment changed to.
export const STATUS_TOAST: Record<AppointmentStatus, "pending" | "confirmed" | "completed" | "cancelled"> = {
  pendiente: "pending",
  confirmado: "confirmed",
  completado: "completed",
  cancelado: "cancelled",
};

// Any status can be set at any time. Cancelling asks first (docs/design.md#confirmations), also from
// the edit form; the other changes are reversible and ask nothing.
export function needsConfirmation(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return to === "cancelado" && from !== "cancelado";
}
