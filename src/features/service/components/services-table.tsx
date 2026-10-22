"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@/components/shared/data-table";
import { ListError, ListNoRows } from "@/components/shared/list-states";
import { TableDate } from "@/components/shared/table-date";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { useListUrl } from "@/hooks/use-list-url";
import { LIST_PAGE_SIZE } from "@/lib/list/params";

import { SERVICE_SORT_COLUMNS } from "../list";
import type { Service } from "../schemas";
import { useServicesPanel } from "./services-panel";

const SORT_IDS = Object.keys(SERVICE_SORT_COLUMNS);
// max-w-0 lets the cell shrink so the description truncates.
const NAME_CELL_CLASS = "w-full max-w-0";

// `pending`: another page, search or sort is loading (the rows shown are the old ones).
type ServicesTableProps =
  | { ok: true; rows: Service[]; matching: number; total: number; pending?: boolean }
  | { ok: false; onRetry: () => void; pending?: boolean };

export function ServicesTable(props: ServicesTableProps) {
  const t = useTranslations("services");
  const { params, clearSearch, setShowArchived, toggleSort, setPage } = useListUrl();
  const { openService, openCreate } = useServicesPanel();

  const pastTheEnd = props.ok && !props.pending && props.rows.length === 0 && params.page > 1;
  useEffect(() => {
    if (pastTheEnd) setPage(1);
  }, [pastTheEnd, setPage]);

  const columns: DataTableColumn<Service>[] = [
    {
      id: "nombre",
      header: t("columns.service"),
      sortable: true,
      className: NAME_CELL_CLASS,
      skeletonLines: 2,
      cell: (service) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{service.name}</span>
            {service.enabled ? null : <ArchivedBadge />}
          </div>
          {service.description ? (
            <span className="truncate text-muted-foreground">{service.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "creado",
      header: t("columns.createdOn"),
      sortable: true,
      cell: (service) => <TableDate value={service.createdAt} />,
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
        getRowId={(service) => service.id}
        sort={sort}
        onSortChange={toggleSort}
      />
    );
  }

  if (!props.ok) return <ListError onRetry={props.onRetry} />;

  if (props.rows.length === 0) {
    return (
      <ListNoRows
        hasSearch={Boolean(params.search)}
        total={props.total}
        texts={{
          noResultsTitle: t("empty.noResultsTitle"),
          noResultsHint: t("empty.noResultsHint"),
          noneTitle: t("empty.noneTitle"),
          noneHint: t("empty.noneHint"),
          onlyArchivedTitle: t("empty.onlyArchivedTitle"),
          onlyArchivedHint: t("empty.onlyArchivedHint"),
        }}
        addLabel={t("add")}
        onAdd={openCreate}
        onClearSearch={clearSearch}
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
        getRowId={(service) => service.id}
        onRowClick={openService}
        isRowMuted={(service) => !service.enabled}
        sort={sort}
        onSortChange={toggleSort}
      />
      <PaginationBar page={params.page} pageSize={LIST_PAGE_SIZE} total={props.matching} onPageChange={setPage} />
    </>
  );
}

export function ServicesTableSkeleton() {
  const t = useTranslations("services");
  return (
    <DataTableSkeleton
      columns={[
        { header: t("columns.service"), lines: 2, className: NAME_CELL_CLASS },
        { header: t("columns.createdOn"), className: "w-32" },
      ]}
    />
  );
}
