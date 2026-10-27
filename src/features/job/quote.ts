import { formatMoney } from "@/lib/format/money";
import { formatPlate } from "@/lib/format/plate";
import type { JobStatus } from "@/lib/status";

import type { JobItem, JobListItem } from "./schemas";

// Statuses that can send the quote. Cancelado is in so a rejected quote can be
// resent after a change.
export const QUOTE_STATUSES: readonly JobStatus[] = [
  "pendiente",
  "presupuesto_enviado",
  "presupuesto_aceptado",
  "cancelado",
];

export type QuoteReason = "status" | "client" | "services";

export type QuoteAvailability = { ok: true } | { ok: false; reason: QuoteReason | null };

// Why the quote can't be sent, in this order: status, client and phone, services.
// `items` is null while the services load: unavailable, with no reason to show.
export function quoteAvailability(job: JobListItem, items: readonly JobItem[] | null): QuoteAvailability {
  if (!QUOTE_STATUSES.includes(job.status)) return { ok: false, reason: "status" };
  if (!job.client || job.client.phoneNumber.replace(/\D/g, "") === "") return { ok: false, reason: "client" };
  if (items === null) return { ok: false, reason: null };
  if (items.length === 0) return { ok: false, reason: "services" };
  return { ok: true };
}

export type ArchivedEntity = "job" | "client" | "vehicle";

// The archived records the quote would be about, to confirm before sending.
export function archivedEntities(job: JobListItem): ArchivedEntity[] {
  const archived: ArchivedEntity[] = [];
  if (!job.enabled) archived.push("job");
  if (job.client && !job.client.enabled) archived.push("client");
  if (!job.vehicle.enabled) archived.push("vehicle");
  return archived;
}

// The message's wording lives in messages/es.json; the caller adapts it to these two.
export type QuoteTemplates = {
  message: (values: { client: string; vehicle: string; lines: string; total: string; signature: string }) => string;
  signature: (values: { shop: string }) => string;
};

// Quantity times the quoted unit price, in cents so decimals never drift.
function lineCents(item: JobItem): number {
  return Math.round(item.quotedUnitPrice * 100) * item.quantity;
}

// The quote as the client reads it: quoted prices only, services in saved order.
export function buildQuoteMessage(
  job: JobListItem,
  items: readonly JobItem[],
  shopName: string | undefined,
  templates: QuoteTemplates,
): string {
  const lines = items
    .map((item) => {
      const quantity = item.quantity > 1 ? ` (x${item.quantity})` : "";
      return `• ${item.serviceName}${quantity}: ${formatMoney(lineCents(item) / 100)}`;
    })
    .join("\n");
  const total = items.reduce((cents, item) => cents + lineCents(item), 0) / 100;

  return templates.message({
    client: job.client?.name ?? "",
    vehicle: `${job.vehicle.brandName} ${job.vehicle.modelName} (${formatPlate(job.vehicle.plate)})`,
    lines,
    total: formatMoney(total),
    signature: shopName ? templates.signature({ shop: shopName }) : "",
  });
}
