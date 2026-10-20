"use client";

import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { KeyboardEvent, ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SortDirection } from "@/lib/list/params";
import { cn } from "@/lib/utils";

import { LoadingRegion } from "./loading-region";

export type ColumnAlign = "left" | "right" | "center";

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  align?: ColumnAlign;
  sortable?: boolean;
  cell: (row: Row) => ReactNode;
  className?: string;
};

export type DataTableSort = { columnId: string; direction: SortDirection };

type DataTableProps<Row> = {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  isRowMuted?: (row: Row) => boolean;
  sort?: DataTableSort;
  onSortChange?: (columnId: string) => void;
  label: string;
};

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const HEAD_CLASS = "px-4 text-xs font-medium text-muted-foreground";

function ariaSort(columnId: string, sort: DataTableSort | undefined) {
  if (sort?.columnId !== columnId) return undefined;
  return sort.direction === "asc" ? "ascending" : "descending";
}

export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  onRowClick,
  isRowMuted,
  sort,
  onSortChange,
  label,
}: DataTableProps<Row>) {
  const t = useTranslations("list");

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className="rounded-xl border bg-card">
      <Table aria-label={label}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const direction = ariaSort(column.id, sort);
              const alignClass = ALIGN_CLASS[column.align ?? "left"];
              return (
                <TableHead
                  key={column.id}
                  aria-sort={direction}
                  className={cn(HEAD_CLASS, direction && "text-foreground", alignClass, column.className)}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.id)}
                      className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {column.header}
                      {direction === "ascending" ? (
                        <CaretUpIcon aria-hidden="true" className="size-3" />
                      ) : direction === "descending" ? (
                        <CaretDownIcon aria-hidden="true" className="size-3" />
                      ) : (
                        <CaretUpDownIcon aria-hidden="true" className="size-3" />
                      )}
                      {direction ? (
                        <span className="sr-only">
                          {direction === "ascending" ? t("sortedAscending") : t("sortedDescending")}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const muted = isRowMuted?.(row) ?? false;
            return (
              <TableRow
                key={getRowId(row)}
                data-muted={muted || undefined}
                data-clickable={onRowClick ? "" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => onRowKeyDown(event, row) : undefined}
                className="outline-none focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset data-muted:text-muted-foreground"
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn("px-4 py-3", ALIGN_CLASS[column.align ?? "left"], column.className)}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export type DataTableSkeletonColumn = {
  header: string;
  align?: ColumnAlign;
  lines?: number;
  className?: string;
};

type DataTableSkeletonProps = {
  columns: readonly DataTableSkeletonColumn[];
  rows?: number;
};

export function DataTableSkeleton({ columns, rows = 8 }: DataTableSkeletonProps) {
  return (
    <LoadingRegion>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.header}
                  className={cn(HEAD_CLASS, ALIGN_CLASS[column.align ?? "left"], column.className)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableCell key={column.header} className={cn("px-4 py-3", column.className)}>
                    <div
                      className={cn(
                        "flex flex-col gap-1.5",
                        column.align === "right" && "items-end",
                        column.align === "center" && "items-center",
                      )}
                    >
                      {Array.from({ length: column.lines ?? 1 }, (_, line) => (
                        <Skeleton
                          key={line}
                          data-testid="skeleton-block"
                          className={cn("h-3.5", line === 0 ? "w-2/5" : "h-3 w-3/5")}
                        />
                      ))}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </LoadingRegion>
  );
}
