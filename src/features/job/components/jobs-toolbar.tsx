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

import { getHomeStatusCounts, getStatusCounts } from "../actions";
import { isClosedStatus } from "@/lib/status";
import { JOB_FILTER, JOB_FILTER_KEYS, jobFiltersToParams, parseJobFilters } from "../list";
import type { JobListScope } from "../queries";
import { NewJobButton } from "./new-job-button";

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
  scope,
}: {
  params: ListParams;
  selected: readonly JobStatus[];
  onChange: (statuses: JobStatus[]) => void;
  scope: JobListScope;
}) {
  const t = useTranslations("jobs.filters");
  const tHome = useTranslations("home.jobs");
  const tStatus = useTranslations("status.job");
  const tCommon = useTranslations("common");
  const key = countsKey(params);
  const fetchCounts = scope === "home" ? getHomeStatusCounts : getStatusCounts;
  const counts = useLoadedData(`${scope}:${key}`, () =>
    fetchCounts(key).then((result) => {
      if (!result.ok) throw new Error("counts");
      return result.counts;
    }),
  );

  const known = counts.status === "ready" ? counts.data : undefined;
  const options: ChecklistOption[] = JOB_STATUSES.map((status) => {
    const windowed = scope === "home" && isClosedStatus(status);
    return {
      value: status,
      label: windowed ? tHome("closedLabel", { status: tStatus(status) }) : tStatus(status),
      accessibleLabel: windowed ? tHome("closedLabelFull", { status: tStatus(status) }) : undefined,
      count: known?.[status],
    };
  });

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
export function JobsToolbar({
  searchPlaceholder,
  scope = "all",
}: {
  searchPlaceholder: string;
  scope?: JobListScope;
}) {
  const t = useTranslations("jobs.filters");
  const tHome = useTranslations("home.jobs");
  const home = scope === "home";
  const tStatus = useTranslations("status.job");
  const { params, searchValue, setSearchValue, setShowArchived, setFilters } = useListUrl(JOB_FILTER_KEYS);
  // Inicio has no dates: a typed-in "desde" or "hasta" means nothing there and is dropped like any
  // other stale filter.
  const parsed = parseJobFilters(params.filters);
  const filters = home ? { ...parsed, from: null, to: null } : parsed;

  // A URL can hold filters that apply to nothing (a half-typed date, a hand-edited value): drop them,
  // so what the address bar says is what the list shows.
  const cleaned = jobFiltersToParams(filters);
  const stale = JOB_FILTER_KEYS.some((key) => (params.filters[key] ?? undefined) !== cleaned[key]);
  useEffect(() => {
    if (stale) setFilters(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cleaned` is rebuilt from `params` each render
  }, [stale]);
  const hasDates = filters.from !== null || filters.to !== null;

  const chips: FilterChip[] = filters.statuses.map((status) => {
    const label =
      home && isClosedStatus(status) ? tHome("closedLabel", { status: tStatus(status) }) : tStatus(status);
    const full =
      home && isClosedStatus(status) ? tHome("closedLabelFull", { status: tStatus(status) }) : tStatus(status);
    return { id: `${JOB_FILTER.status}:${status}`, label, removeLabel: t("remove", { filter: full }) };
  });
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
        onShowArchivedChange={home ? undefined : setShowArchived}
        actions={<NewJobButton />}
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
                scope={scope}
                onChange={(statuses) =>
                  setFilters({ [JOB_FILTER.status]: statuses.length > 0 ? statuses.join(",") : undefined })
                }
              />
            </FilterPopover>
            {home ? null : (
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
            )}
          </>
        }
      />
      <FilterChips chips={chips} onRemove={removeChip} />
    </>
  );
}
