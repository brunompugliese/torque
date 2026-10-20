"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@/components/shared/data-table";
import { ListEmpty, ListError } from "@/components/shared/list-states";
import { TableDate } from "@/components/shared/table-date";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Button } from "@/components/ui/button";
import { useListUrl } from "@/hooks/use-list-url";
import { LIST_PAGE_SIZE, resolveSortBy } from "@/lib/list/params";

import { SERVICE_DEFAULT_SORT, SERVICE_SORT_COLUMNS, type Service } from "../schemas";
import { useServicesPanel } from "./services-panel";

const SORT_IDS = Object.keys(SERVICE_SORT_COLUMNS);
// max-w-0 lets the cell shrink so the description truncates.
const NAME_CELL_CLASS = "w-full max-w-0";

type ServicesTableProps =
  | { ok: true; rows: Service[]; matching: number; total: number }
  | { ok: false };

export function ServicesTable(props: ServicesTableProps) {
  const t = useTranslations("services");
  const tList = useTranslations("list");
  const router = useRouter();
  const { params, clearSearch, setShowArchived, toggleSort, setPage } = useListUrl();
  const { openService, openCreate } = useServicesPanel();

  const pastTheEnd = props.ok && props.rows.length === 0 && params.page > 1;
  useEffect(() => {
    if (pastTheEnd) setPage(1);
  }, [pastTheEnd, setPage]);

  if (!props.ok) return <ListError onRetry={() => router.refresh()} />;

  if (props.rows.length === 0) {
    if (params.search) {
      return (
        <ListEmpty
          title={t("empty.noResultsTitle")}
          hint={t("empty.noResultsHint")}
          action={
            <Button variant="outline" onClick={clearSearch}>
              {tList("clearSearch")}
            </Button>
          }
        />
      );
    }
    if (props.total === 0) {
      return (
        <ListEmpty
          title={t("empty.noneTitle")}
          hint={t("empty.noneHint")}
          action={<Button onClick={openCreate}>{t("add")}</Button>}
        />
      );
    }
    return (
      <ListEmpty
        title={t("empty.onlyArchivedTitle")}
        hint={t("empty.onlyArchivedHint")}
        action={
          <Button variant="outline" onClick={() => setShowArchived(true)}>
            {tList("showArchived")}
          </Button>
        }
      />
    );
  }

  const columns: DataTableColumn<Service>[] = [
    {
      id: "nombre",
      header: t("columns.service"),
      sortable: true,
      className: NAME_CELL_CLASS,
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

  return (
    <>
      <DataTable
        label={t("title")}
        columns={columns}
        rows={props.rows}
        getRowId={(service) => service.id}
        onRowClick={openService}
        isRowMuted={(service) => !service.enabled}
        sort={{ columnId: resolveSortBy(params.sortBy, SORT_IDS, SERVICE_DEFAULT_SORT), direction: params.sort }}
        onSortChange={(columnId) => toggleSort(columnId, SERVICE_DEFAULT_SORT)}
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
