import type { JobPhase } from "@/lib/status";

import type { VehicleJob } from "./schemas";

export type JobTotal = { amount: number; kind: "final" | "quoted" };

// Lists show the final total, labelled "Final", when the job has one, otherwise
// the quoted one, labelled "Presupuestado" (docs/design.md#prices).
export function jobTotal(job: Pick<VehicleJob, "finalTotal" | "quotedTotal">): JobTotal | null {
  if (job.finalTotal !== null) return { amount: job.finalTotal, kind: "final" };
  if (job.quotedTotal !== null) return { amount: job.quotedTotal, kind: "quoted" };
  return null;
}

export type PricedItem = { quantity: number; quotedUnitPrice: number; finalUnitPrice: number | null };

export type JobTotals = { quoted: number; final: number | null };

// Sums in cents so decimals never drift (12.10 × 3 is exactly 36.30).
function sumCents(items: readonly PricedItem[], unitPrice: (item: PricedItem) => number): number {
  return items.reduce((cents, item) => cents + Math.round(unitPrice(item) * 100) * item.quantity, 0);
}

// The quoted total is always calculated; the final total only in the work phase
// (docs/design.md#prices, rule 5). A missing final price counts as the quoted one.
export function calculateTotals(items: readonly PricedItem[], phase: JobPhase): JobTotals {
  const quoted = sumCents(items, (item) => item.quotedUnitPrice) / 100;
  if (phase === "quote") return { quoted, final: null };
  return { quoted, final: sumCents(items, (item) => item.finalUnitPrice ?? item.quotedUnitPrice) / 100 };
}

// Switching a form into the work phase: rows with an empty final price get the quoted one.
export function fillFinalPrices<Row extends { quotedUnitPrice: string; finalUnitPrice: string }>(
  rows: readonly Row[],
): Row[] {
  return rows.map((row) =>
    row.finalUnitPrice.trim() === "" ? { ...row, finalUnitPrice: row.quotedUnitPrice } : row,
  );
}
