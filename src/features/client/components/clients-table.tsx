"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@/components/shared/data-table";
import { ListError, ListNoRows } from "@/components/shared/list-states";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { TableDate } from "@/components/shared/table-date";
import { useListUrl } from "@/hooks/use-list-url";
import { formatDni } from "@/lib/format/dni";
import { LIST_PAGE_SIZE } from "@/lib/list/params";

import { formatClientName } from "../format";
import { CLIENT_SORT_COLUMNS } from "../list";
import type { Client } from "../schemas";
import { useClientsPanel } from "./clients-panel";

const SORT_IDS = Object.keys(CLIENT_SORT_COLUMNS);
// max-w-0 lets the cell shrink so a long name truncates; min-w keeps it
// readable when a narrow screen squeezes the table (the table scrolls sideways).
const NAME_CELL_CLASS = "w-full min-w-44 max-w-0";
const EMAIL_CELL_CLASS = "max-w-56";
const EMPTY = "—";

type ClientsTableProps =
  | { ok: true; rows: Client[]; matching: number; total: number }
  | { ok: false; onRetry: () => void };

export function ClientsTable(props: ClientsTableProps) {
  const t = useTranslations("clients");
  const { params, clearSearch, setShowArchived, toggleSort, setPage } = useListUrl();
  const { openClient, openCreate } = useClientsPanel();

  const pastTheEnd = props.ok && props.rows.length === 0 && params.page > 1;
  useEffect(() => {
    if (pastTheEnd) setPage(1);
  }, [pastTheEnd, setPage]);

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

  const columns: DataTableColumn<Client>[] = [
    {
      id: "cliente",
      header: t("columns.client"),
      sortable: true,
      className: NAME_CELL_CLASS,
      cell: (client) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{formatClientName(client)}</span>
          {client.enabled ? null : <ArchivedBadge />}
        </div>
      ),
    },
    {
      id: "dni",
      header: t("columns.dni"),
      sortable: true,
      align: "right",
      cell: (client) =>
        client.dni ? <span className="whitespace-nowrap tabular-nums">{formatDni(client.dni)}</span> : EMPTY,
    },
    {
      id: "telefono",
      header: t("columns.phone"),
      sortable: true,
      cell: (client) => <span className="whitespace-nowrap">{client.phoneNumber}</span>,
    },
    {
      id: "email",
      header: t("columns.email"),
      sortable: true,
      className: EMAIL_CELL_CLASS,
      cell: (client) => (client.email ? <span className="block truncate">{client.email}</span> : EMPTY),
    },
    {
      id: "creado",
      header: t("columns.createdOn"),
      sortable: true,
      cell: (client) => <TableDate value={client.createdAt} />,
    },
  ];

  return (
    <>
      <DataTable
        label={t("title")}
        columns={columns}
        rows={props.rows}
        getRowId={(client) => client.id}
        onRowClick={openClient}
        isRowMuted={(client) => !client.enabled}
        sort={SORT_IDS.includes(params.sortBy) ? { columnId: params.sortBy, direction: params.sort } : undefined}
        onSortChange={toggleSort}
      />
      <PaginationBar page={params.page} pageSize={LIST_PAGE_SIZE} total={props.matching} onPageChange={setPage} />
    </>
  );
}

export function ClientsTableSkeleton() {
  const t = useTranslations("clients");
  return (
    <DataTableSkeleton
      columns={[
        { header: t("columns.client"), className: NAME_CELL_CLASS },
        { header: t("columns.dni"), align: "right", className: "w-28" },
        { header: t("columns.phone"), className: "w-36" },
        { header: t("columns.email"), className: EMAIL_CELL_CLASS },
        { header: t("columns.createdOn"), className: "w-32" },
      ]}
    />
  );
}
