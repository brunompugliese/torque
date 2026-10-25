import type { AppointmentStatus } from "@/lib/status";

import type { AppointmentFormValues, AppointmentListItem } from "./schemas";

// What the appointment form holds before it is validated.
export type AppointmentFormState = {
  vehicleId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  reason: string;
};

// A new appointment: Pendiente, on the clicked day (or today), with no time chosen.
export function emptyAppointmentForm(date: string): AppointmentFormState {
  return { vehicleId: "", date, time: "", status: "pendiente", reason: "" };
}

// The form for editing a saved appointment.
export function appointmentToFormState(appointment: AppointmentListItem): AppointmentFormState {
  return {
    vehicleId: appointment.vehicle.id,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    reason: appointment.reason ?? "",
  };
}

// An edit that changed nothing goes back to the appointment without a request (docs/design.md#modals).
export function isAppointmentUnchanged(values: AppointmentFormValues, appointment: AppointmentListItem): boolean {
  return (
    values.vehicleId === appointment.vehicle.id &&
    values.date === appointment.date &&
    values.time === appointment.time &&
    values.status === appointment.status &&
    values.reason === (appointment.reason?.trim() || null)
  );
}

// An appointment's client is its vehicle's owner when it was created and does not change by itself:
// it is kept while the vehicle is the same and follows the new vehicle's owner when the vehicle changes.
export function appointmentClientId(
  stored: { vehicleId: string; clientId: string | null } | null,
  vehicleId: string,
  ownerId: string | null,
): string | null {
  if (stored && stored.vehicleId === vehicleId) return stored.clientId;
  return ownerId;
}
