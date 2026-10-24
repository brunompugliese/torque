import { formatKmInput } from "@/lib/format/km";
import { moneyInputText, parseMoney } from "@/lib/validation/money-fields";

import type { JobFormValues, JobItem, JobListItem } from "./schemas";
import type { PricedItem } from "./total";

// One service row as the form holds it: text, as typed.
export type JobFormRow = {
  // The saved item being edited; empty for a row added in this form.
  id: string;
  serviceId: string;
  quantity: string;
  quotedUnitPrice: string;
  finalUnitPrice: string;
};

// What the job form holds before it is validated.
export type JobFormState = {
  vehicleId: string;
  clientId: string;
  status: JobListItem["status"];
  kilometers: string;
  appointmentId: string;
  observations: string;
  items: JobFormRow[];
};

export function emptyJobRow(): JobFormRow {
  return { id: "", serviceId: "", quantity: "1", quotedUnitPrice: "", finalUnitPrice: "" };
}

// A new job: Pendiente, nothing else chosen.
export function emptyJobForm(): JobFormState {
  return {
    vehicleId: "",
    clientId: "",
    status: "pendiente",
    kilometers: "",
    appointmentId: "",
    observations: "",
    items: [],
  };
}

// The form for editing a saved job.
export function jobToFormState(job: JobListItem, items: readonly JobItem[]): JobFormState {
  return {
    vehicleId: job.vehicle.id,
    clientId: job.client?.id ?? "",
    status: job.status,
    kilometers: job.kilometers === null ? "" : formatKmInput(String(job.kilometers)),
    appointmentId: job.appointment?.id ?? "",
    observations: job.observations ?? "",
    items: items.map((item) => ({
      id: item.id,
      serviceId: item.serviceId,
      quantity: String(item.quantity),
      quotedUnitPrice: moneyInputText(item.quotedUnitPrice),
      finalUnitPrice: item.finalUnitPrice === null ? "" : moneyInputText(item.finalUnitPrice),
    })),
  };
}

// A job's client is its vehicle's owner, or none: nobody picks it. An archived owner can't be put
// on a job, except on one that already has it (the database only checks a client when it changes).
export function jobClientId(
  owner: { id: string; enabled: boolean } | null,
  currentClientId: string | null,
): string | null {
  if (!owner) return null;
  return owner.enabled || owner.id === currentClientId ? owner.id : null;
}

// An edit that changed nothing goes back to the job without a request (docs/design.md#modals).
export function isJobUnchanged(values: JobFormValues, job: JobListItem, items: readonly JobItem[]): boolean {
  if (
    values.vehicleId !== job.vehicle.id ||
    values.clientId !== (job.client?.id ?? null) ||
    values.status !== job.status ||
    values.kilometers !== job.kilometers ||
    values.appointmentId !== (job.appointment?.id ?? null) ||
    values.observations !== (job.observations?.trim() || null) ||
    values.items.length !== items.length
  ) {
    return false;
  }
  return values.items.every((row, index) => {
    const saved = items[index];
    return (
      row.id === saved.id &&
      row.serviceId === saved.serviceId &&
      row.quantity === saved.quantity &&
      row.quotedUnitPrice === saved.quotedUnitPrice &&
      row.finalUnitPrice === saved.finalUnitPrice
    );
  });
}

// The numbers behind the rows being typed, for the live totals and subtotals: what can't be
// read yet counts as zero (and a missing final price as the quoted one).
export function rowAmounts(rows: readonly JobFormRow[]): PricedItem[] {
  return rows.map((row) => {
    const quantity = /^\d+$/.test(row.quantity.trim()) ? Number(row.quantity) : 0;
    const quotedUnitPrice = parseMoney(row.quotedUnitPrice) ?? 0;
    return { quantity, quotedUnitPrice, finalUnitPrice: parseMoney(row.finalUnitPrice) };
  });
}
