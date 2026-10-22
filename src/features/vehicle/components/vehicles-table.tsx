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
import { formatKm } from "@/lib/format/km";
import { LIST_PAGE_SIZE } from "@/lib/list/params";

import { VEHICLE_SORT_COLUMNS } from "../list";
import type { VehicleListItem } from "../schemas";
import { useVehiclesPanel } from "./vehicles-panel";

const SORT_IDS = Object.keys(VEHICLE_SORT_COLUMNS);
// max-w-0 lets the cell shrink so a long name truncates; min-w keeps it
// readable when a narrow screen squeezes the table (the table scrolls sideways).
const VEHICLE_CELL_CLASS = "w-full min-w-44 max-w-0";
const CLIENT_CELL_CLASS = "max-w-56 min-w-36";
const EMPTY = "—";

// `pending`: another page, search or sort is loading (the rows shown are the old ones).
type VehiclesTableProps =
  | { ok: true; rows: VehicleListItem[]; matching: number; total: number; pending?: boolean }
  | { ok: false; onRetry: () => void; pending?: boolean };

export function VehiclesTable(props: VehiclesTableProps) {
  const t = useTranslations("vehicles");
  const { params, clearSearch, setShowArchived, toggleSort, setPage } = useListUrl();
  const { openVehicle, openCreate } = useVehiclesPanel();

  const pastTheEnd = props.ok && !props.pending && props.rows.length === 0 && params.page > 1;
  useEffect(() => {
    if (pastTheEnd) setPage(1);
  }, [pastTheEnd, setPage]);

  const columns: DataTableColumn<VehicleListItem>[] = [
    {
      id: "patente",
      header: t("columns.plate"),
      sortable: true,
      align: "center",
      cell: (vehicle) => <PlateDisplay plate={vehicle.plate} />,
    },
    {
      id: "vehiculo",
      header: t("columns.vehicle"),
      sortable: true,
      className: VEHICLE_CELL_CLASS,
      cell: (vehicle) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">
            {vehicle.brandName} {vehicle.modelName}
          </span>
          {vehicle.enabled ? null : <ArchivedBadge />}
        </div>
      ),
    },
    {
      id: "anio",
      header: t("columns.year"),
      sortable: true,
      align: "right",
      cell: (vehicle) => (vehicle.year === null ? EMPTY : <span className="tabular-nums">{vehicle.year}</span>),
    },
    {
      id: "vin",
      header: t("columns.vin"),
      sortable: true,
      cell: (vehicle) => (vehicle.vin ? <span className="whitespace-nowrap tabular-nums">{vehicle.vin}</span> : EMPTY),
    },
    {
      id: "cliente",
      header: t("columns.client"),
      sortable: true,
      className: CLIENT_CELL_CLASS,
      cell: ({ client }) =>
        client ? (
          <span className="block truncate">
            {client.enabled ? formatClientName(client) : t("clientArchived", { name: formatClientName(client) })}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("noClient")}</span>
        ),
    },
    {
      id: "km",
      header: t("columns.lastKm"),
      sortable: true,
      align: "right",
      cell: (vehicle) =>
        vehicle.lastKm === null ? EMPTY : <span className="whitespace-nowrap tabular-nums">{formatKm(vehicle.lastKm)}</span>,
    },
    {
      id: "creado",
      header: t("columns.createdOn"),
      sortable: true,
      cell: (vehicle) => <TableDate value={vehicle.createdAt} />,
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
        getRowId={(vehicle) => vehicle.id}
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
        getRowId={(vehicle) => vehicle.id}
        onRowClick={openVehicle}
        isRowMuted={(vehicle) => !vehicle.enabled}
        sort={sort}
        onSortChange={toggleSort}
      />
      <PaginationBar page={params.page} pageSize={LIST_PAGE_SIZE} total={props.matching} onPageChange={setPage} />
    </>
  );
}

export function VehiclesTableSkeleton() {
  const t = useTranslations("vehicles");
  return (
    <DataTableSkeleton
      columns={[
        { header: t("columns.plate"), align: "center", className: PLATE_WIDTH_CLASS },
        { header: t("columns.vehicle"), className: VEHICLE_CELL_CLASS },
        { header: t("columns.year"), align: "right", className: "w-20" },
        { header: t("columns.vin"), className: "w-48" },
        { header: t("columns.client"), className: CLIENT_CELL_CLASS },
        { header: t("columns.lastKm"), align: "right", className: "w-28" },
        { header: t("columns.createdOn"), className: "w-32" },
      ]}
    />
  );
}
