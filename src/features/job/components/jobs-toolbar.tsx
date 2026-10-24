"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { ChecklistFilter, type ChecklistOption } from "@/components/shared/checklist-filter";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { FilterChips, type FilterChip } from "@/components/shared/filter-chips";
import { FilterPopover } from "@/components/shared/filter-popover";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { useListUrl } from "@/hooks/use-list-url";
import { useLoadedData } from "@/hooks/use-loaded-data";
import { formatIsoDate } from "@/lib/format/date";
import { toListSearch, type ListParams } from "@/lib/list/params";
import { JOB_STATUSES, type JobStatus } from "@/lib/status";

import { getStatusCounts } from "../actions";
import { JOB_FILTER, JOB_FILTER_KEYS, jobFiltersToParams, parseJobFilters } from "../list";

// What the Estado counts depend on: the search, the archived switch and the dates
// (not the Estado selection itself, nor the page or the sort).
function countsKey(params: ListParams): string {
  const filters = { ...params.filters };
  delete filters[JOB_FILTER.status];
  return toListSearch({ ...params, filters, sortBy: "", sort: "asc", page: 1 });
}

// Mounted when the popover opens, so the counts are only asked for when someone looks at them.
function StatusFilterPanel({
  params,
  selected,
  onChange,
}: {
  params: ListParams;
  selected: readonly JobStatus[];
  onChange: (statuses: JobStatus[]) => void;
}) {
  const t = useTranslations("jobs.filters");
  const tStatus = useTranslations("status.job");
  const tCommon = useTranslations("common");
  const key = countsKey(params);
  const counts = useLoadedData(key, () =>
    getStatusCounts(key).then((result) => {
      if (!result.ok) throw new Error("counts");
      return result.counts;
    }),
  );

  const known = counts.status === "ready" ? counts.data : undefined;
  const options: ChecklistOption[] = JOB_STATUSES.map((status) => ({
    value: status,
    label: tStatus(status),
    count: known?.[status],
  }));

  return (
    <>
      <ChecklistFilter
        options={options}
        selected={selected}
        onChange={(next) => onChange(next as JobStatus[])}
        loadingCounts={counts.status === "loading"}
        loadingLabel={tCommon("loading")}
      />
      {counts.status === "error" ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("countsError")}
        </p>
      ) : null}
    </>
  );
}

// The jobs list's toolbar: search, the Estado and Fecha filters, "Mostrar archivados", and the
// active filters as removable chips.
export function JobsToolbar({ searchPlaceholder }: { searchPlaceholder: string }) {
  const t = useTranslations("jobs.filters");
  const tStatus = useTranslations("status.job");
  const { params, searchValue, setSearchValue, setShowArchived, setFilters } = useListUrl(JOB_FILTER_KEYS);
  const filters = parseJobFilters(params.filters);

  // A URL can hold filters that apply to nothing (a half-typed date, a hand-edited value): drop them,
  // so what the address bar says is what the list shows.
  const cleaned = jobFiltersToParams(filters);
  const stale = JOB_FILTER_KEYS.some((key) => (params.filters[key] ?? undefined) !== cleaned[key]);
  useEffect(() => {
    if (stale) setFilters(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cleaned` is rebuilt from `params` each render
  }, [stale]);
  const hasDates = filters.from !== null || filters.to !== null;

  const chips: FilterChip[] = filters.statuses.map((status) => ({
    id: `${JOB_FILTER.status}:${status}`,
    label: tStatus(status),
    removeLabel: t("remove", { filter: tStatus(status) }),
  }));
  if (hasDates) {
    const label =
      filters.from && filters.to
        ? t("dateChip", { from: formatIsoDate(filters.from), to: formatIsoDate(filters.to) })
        : filters.from
          ? t("dateChipFrom", { from: formatIsoDate(filters.from) })
          : t("dateChipTo", { to: formatIsoDate(filters.to ?? "") });
    chips.push({ id: "fecha", label, removeLabel: t("remove", { filter: label }) });
  }

  function removeChip(id: string) {
    if (id === "fecha") {
      setFilters({ [JOB_FILTER.from]: undefined, [JOB_FILTER.to]: undefined });
      return;
    }
    const status = id.slice(JOB_FILTER.status.length + 1);
    setFilters(
      jobFiltersToParams({ ...filters, statuses: filters.statuses.filter((current) => current !== status) }),
    );
  }

  return (
    <>
      <ListToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={searchPlaceholder}
        showArchived={params.showArchived}
        onShowArchivedChange={setShowArchived}
        filters={
          <>
            <FilterPopover
              label={t("status")}
              active={filters.statuses.length > 0}
              count={filters.statuses.length}
              onClear={() => setFilters({ [JOB_FILTER.status]: undefined })}
            >
              <StatusFilterPanel
                params={params}
                selected={filters.statuses}
                onChange={(statuses) =>
                  setFilters({ [JOB_FILTER.status]: statuses.length > 0 ? statuses.join(",") : undefined })
                }
              />
            </FilterPopover>
            <FilterPopover
              label={t("date")}
              active={hasDates}
              onClear={() => setFilters({ [JOB_FILTER.from]: undefined, [JOB_FILTER.to]: undefined })}
            >
              <DateRangeFilter
                value={{ from: filters.from ?? "", to: filters.to ?? "" }}
                onChange={(range) =>
                  setFilters({ [JOB_FILTER.from]: range.from || undefined, [JOB_FILTER.to]: range.to || undefined })
                }
                fromLabel={t("from")}
                toLabel={t("to")}
                orderError={t("dateOrderError")}
              />
            </FilterPopover>
          </>
        }
      />
      <FilterChips chips={chips} onRemove={removeChip} />
    </>
  );
}
