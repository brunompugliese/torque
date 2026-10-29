"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@/components/shared/data-table";
import { ListError, ListNoRows } from "@/components/shared/list-states";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { PLATE_WIDTH_CLASS, PlateDisplay } from "@/components/shared/plate-display";
import { TableDate } from "@/components/shared/table-date";
import { formatClientName } from "@/features/client/format";
import { useListUrl } from "@/hooks/use-list-url";
import { formatJobNumber } from "@/lib/format/job-number";
import { formatKm } from "@/lib/format/km";
import { formatMoney } from "@/lib/format/money";
import { LIST_PAGE_SIZE } from "@/lib/list/params";

import type { JobListScope } from "../queries";

import { JOB_FILTER_KEYS, JOB_SORT_COLUMNS } from "../list";
import type { JobListItem } from "../schemas";
import { jobTotal } from "../total";
import { useJobsPanel } from "./jobs-panel";
import { JobStatusControl } from "./job-status-control";

const SORT_IDS = Object.keys(JOB_SORT_COLUMNS);
// max-w-0 lets the cell shrink so a long name truncates; min-w keeps it
// readable when a narrow screen squeezes the table (the table scrolls sideways).
const VEHICLE_CELL_CLASS = "w-full min-w-44 max-w-0";
const CLIENT_CELL_CLASS = "max-w-56 min-w-36";
const EMPTY = "—";

// `pending`: another page, search, filter or sort is loading (the rows shown are the old ones).
type JobsTableProps =
  | { ok: true; rows: JobListItem[]; matching: number; total: number; pending?: boolean; scope?: JobListScope }
  | { ok: false; onRetry: () => void; pending?: boolean; scope?: JobListScope };

export function JobsTable(props: JobsTableProps) {
  const t = useTranslations("jobs");
  const tHome = useTranslations("home.jobs");
  const { params, clearAll, setShowArchived, toggleSort, setPage } = useListUrl(JOB_FILTER_KEYS);
  const { openJob, openCreate } = useJobsPanel();

  const pastTheEnd = props.ok && !props.pending && props.rows.length === 0 && params.page > 1;
  useEffect(() => {
    if (pastTheEnd) setPage(1);
  }, [pastTheEnd, setPage]);

  const columns: DataTableColumn<JobListItem>[] = [
    {
      id: "numero",
      header: t("columns.number"),
      sortable: true,
      cell: (job) => <span className="whitespace-nowrap tabular-nums">{formatJobNumber(job.number)}</span>,
    },
    {
      id: "patente",
      header: t("columns.plate"),
      sortable: true,
      align: "center",
      cell: (job) => <PlateDisplay plate={job.vehicle.plate} />,
    },
    {
      id: "vehiculo",
      header: t("columns.vehicle"),
      sortable: true,
      className: VEHICLE_CELL_CLASS,
      skeletonLines: 2,
      cell: ({ vehicle, enabled }) => (
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">
              {vehicle.brandName} {vehicle.modelName}
            </span>
            {enabled ? null : <ArchivedBadge />}
          </div>
          {vehicle.year === null ? null : (
            <span className="text-xs text-muted-foreground tabular-nums">{vehicle.year}</span>
          )}
        </div>
      ),
    },
    {
      id: "cliente",
      header: t("columns.client"),
      sortable: true,
      className: CLIENT_CELL_CLASS,
      cell: ({ client }) =>
        client ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className={client.enabled ? "truncate" : "truncate text-muted-foreground"}>
              {formatClientName(client)}
            </span>
            {client.enabled ? null : <ArchivedBadge />}
          </div>
        ) : (
          <span className="text-muted-foreground">{t("noClient")}</span>
        ),
    },
    {
      id: "estado",
      header: t("columns.status"),
      sortable: true,
      cell: (job) => <JobStatusControl job={job} />,
    },
    {
      id: "km",
      header: t("columns.kilometers"),
      sortable: true,
      align: "right",
      cell: (job) =>
        job.kilometers === null ? EMPTY : <span className="whitespace-nowrap tabular-nums">{formatKm(job.kilometers)}</span>,
    },
    {
      id: "total",
      header: t("columns.total"),
      sortable: true,
      align: "right",
      skeletonLines: 2,
      cell: (job) => {
        const total = jobTotal(job);
        if (!total) return EMPTY;
        return (
          <div className="flex flex-col items-end">
            <span className="whitespace-nowrap tabular-nums">{formatMoney(total.amount)}</span>
            <span className="text-xs text-muted-foreground">
              {total.kind === "final" ? t("totalFinal") : t("totalQuoted")}
            </span>
          </div>
        );
      },
    },
    {
      id: "actualizado",
      header: t("columns.updatedOn"),
      sortable: true,
      cell: (job) => <TableDate value={job.updatedAt} />,
    },
  ];
  const sort = SORT_IDS.includes(params.sortBy) ? { columnId: params.sortBy, direction: params.sort } : undefined;

  // While the next rows load the header stays and the body shows placeholders.
  if (props.pending) {
    return (
      <DataTable
        loading
        label={t("title")}
        columns={columns}
        rows={props.ok ? props.rows : []}
        getRowId={(job) => job.id}
        sort={sort}
        onSortChange={toggleSort}
      />
    );
  }

  if (!props.ok) return <ListError onRetry={props.onRetry} />;

  if (props.rows.length === 0) {
    return (
      <ListNoRows
        hasSearch={Boolean(params.search) || Object.keys(params.filters).length > 0}
        total={props.total}
        texts={{
          noResultsTitle: t("empty.noResultsTitle"),
          noResultsHint: t("empty.noResultsHint"),
          noneTitle: props.scope === "home" ? tHome("empty.title") : t("empty.noneTitle"),
          noneHint: props.scope === "home" ? tHome("empty.hint") : t("empty.noneHint"),
          onlyArchivedTitle: t("empty.onlyArchivedTitle"),
          onlyArchivedHint: t("empty.onlyArchivedHint"),
        }}
        addLabel={t("add")}
        onAdd={openCreate}
        onClearSearch={clearAll}
        clearLabel={t("empty.clearAll")}
        onShowArchived={() => setShowArchived(true)}
      />
    );
  }

  return (
    <>
      <DataTable
        label={t("title")}
        columns={columns}
        rows={props.rows}
        getRowId={(job) => job.id}
        onRowClick={openJob}
        isRowMuted={(job) => !job.enabled}
        sort={sort}
        onSortChange={toggleSort}
      />
      <PaginationBar page={params.page} pageSize={LIST_PAGE_SIZE} total={props.matching} onPageChange={setPage} />
    </>
  );
}

export function JobsTableSkeleton() {
  const t = useTranslations("jobs");
  return (
    <DataTableSkeleton
      columns={[
        { header: t("columns.number"), className: "w-28" },
        { header: t("columns.plate"), align: "center", className: PLATE_WIDTH_CLASS },
        { header: t("columns.vehicle"), className: VEHICLE_CELL_CLASS, lines: 2 },
        { header: t("columns.client"), className: CLIENT_CELL_CLASS },
        { header: t("columns.status"), className: "w-40" },
        { header: t("columns.kilometers"), align: "right", className: "w-28" },
        { header: t("columns.total"), align: "right", className: "w-32", lines: 2 },
        { header: t("columns.updatedOn"), className: "w-32" },
      ]}
    />
  );
}
