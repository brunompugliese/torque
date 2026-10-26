import { formatIsoDate } from "@/lib/format/date";

import type { AppointmentListItem } from "./schemas";

type Vehicle = Pick<AppointmentListItem["vehicle"], "brandName" | "modelName" | "year">;

// "Fiat Cronos 2021", or "Fiat Cronos" without a year.
export function formatAppointmentVehicle({ vehicle }: { vehicle: Vehicle }): string {
  return [vehicle.brandName, vehicle.modelName, vehicle.year].filter((part) => part !== null).join(" ");
}

// "14/10/2026 · 09:00 hs": the modal's title.
export function formatAppointmentWhen({ date, time }: Pick<AppointmentListItem, "date" | "time">): string {
  return `${formatIsoDate(date)} · ${time} hs`;
}

// "Fiat Cronos, 14/10/2026 a las 09:00 hs": what a toast says about an appointment.
export function formatAppointmentLabel(
  appointment: Pick<AppointmentListItem, "date" | "time"> & { vehicle: Pick<Vehicle, "brandName" | "modelName"> },
): string {
  const { vehicle, date, time } = appointment;
  return `${vehicle.brandName} ${vehicle.modelName}, ${formatIsoDate(date)} a las ${time} hs`;
}
