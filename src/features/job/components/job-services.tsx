"use client";

import { useTranslations } from "next-intl";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format/money";
import { jobPhase, type JobStatus } from "@/lib/status";

import type { JobItem } from "../schemas";
import { calculateTotals } from "../total";

// The services of one job. Quote phase: Servicio · Cant. · Precio. Work phase:
// Servicio · Cant. · Presupuestado · Final. The totals are in the last row.
// A cancelled job shows the phase it was in (work when its services have final prices).
export function JobServices({ items, status }: { items: readonly JobItem[]; status: JobStatus }) {
  const t = useTranslations("jobs.services");

  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;

  const phase = jobPhase(
    status,
    items.some((item) => item.finalUnitPrice !== null),
  );
  const totals = calculateTotals(items, phase);
  const head = "px-3 text-xs font-medium text-muted-foreground";

  return (
    <div className="rounded-lg border">
      <Table aria-label={t("title")}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={head}>{t("service")}</TableHead>
            <TableHead className={`${head} text-right`}>{t("quantity")}</TableHead>
            {phase === "quote" ? (
              <TableHead className={`${head} text-right`}>{t("price")}</TableHead>
            ) : (
              <>
                <TableHead className={`${head} text-right`}>{t("quoted")}</TableHead>
                <TableHead className={`${head} text-right`}>{t("final")}</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-transparent">
              <TableCell className="px-3 whitespace-normal">
                <span className={item.serviceEnabled ? undefined : "text-muted-foreground"}>
                  {item.serviceEnabled ? item.serviceName : t("archived", { name: item.serviceName })}
                </span>
              </TableCell>
              <TableCell className="px-3 text-right tabular-nums">{item.quantity}</TableCell>
              <TableCell className="px-3 text-right whitespace-nowrap tabular-nums">
                {formatMoney(item.quotedUnitPrice)}
              </TableCell>
              {phase === "work" ? (
                <TableCell className="px-3 text-right whitespace-nowrap tabular-nums">
                  {formatMoney(item.finalUnitPrice ?? item.quotedUnitPrice)}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-medium hover:bg-muted/50">
            <TableCell className="px-3" colSpan={2}>
              {t("total")}
            </TableCell>
            <TableCell className="px-3 text-right whitespace-nowrap tabular-nums">{formatMoney(totals.quoted)}</TableCell>
            {phase === "work" ? (
              <TableCell className="px-3 text-right whitespace-nowrap tabular-nums">
                {formatMoney(totals.final ?? totals.quoted)}
              </TableCell>
            ) : null}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
