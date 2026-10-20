"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ListEmpty } from "@/components/shared/list-states";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { SearchBox } from "@/components/shared/search-box";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import type { Vehicle } from "@/features/vehicle/schemas";
import { VehicleRow } from "@/features/vehicle/components/vehicle-row";
import { filterByText, paginate } from "@/lib/list/memory";

export const ASSIGN_PAGE_SIZE = 5;

// What the caller tells the step happened after trying to assign.
export type AssignOutcome = "done" | "partial" | "alreadyAssigned" | "error";

type AssignVehiclesProps = {
  vehicles: readonly Vehicle[];
  onSubmit: (vehicleIds: string[]) => Promise<AssignOutcome>;
};

const searchText = (vehicle: Vehicle) =>
  [vehicle.plate, vehicle.brandName, vehicle.modelName, vehicle.year, vehicle.vin].filter(Boolean).join(" ");

// Search and paging happen in memory over the list already loaded: no request.
// The selection lives across searches and pages.
export function AssignVehicles({ vehicles, onSubmit }: AssignVehiclesProps) {
  const t = useTranslations("clients.assign");
  const tCommon = useTranslations("common");
  const tList = useTranslations("list");

  const [term, setTerm] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<"none" | "partial" | "alreadyHasClient" | "error" | null>(null);
  const [saving, setSaving] = useState(false);

  // A vehicle that left the list (assigned meanwhile) leaves the selection.
  const selected = useMemo(
    () => vehicles.filter((vehicle) => chosen.has(vehicle.id)).map((vehicle) => vehicle.id),
    [vehicles, chosen],
  );
  const filtered = useMemo(() => filterByText(vehicles, term, searchText), [vehicles, term]);
  const { rows, page } = paginate(filtered, requestedPage, ASSIGN_PAGE_SIZE);

  const toggle = (id: string, checked: boolean) => {
    setMessage(null);
    setChosen((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const search = (value: string) => {
    setTerm(value);
    setRequestedPage(1);
  };

  const submit = async () => {
    if (selected.length === 0) {
      setMessage("none");
      return;
    }
    setSaving(true);
    try {
      const outcome = await onSubmit(selected);
      // Decided now: the refreshed list drops the vehicles that were taken.
      if (outcome === "alreadyAssigned") setMessage(selected.length === 1 ? "alreadyHasClient" : "partial");
      else setMessage(outcome === "done" ? null : outcome);
    } finally {
      setSaving(false);
    }
  };

  const messageText: Record<NonNullable<typeof message>, string> = {
    none: t("noneSelected"),
    partial: t("partial"),
    alreadyHasClient: t("alreadyHasClient"),
    error: tCommon("unexpectedError"),
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3"
    >
      {/* Enter in the search box filters; it must not submit the assignment. */}
      <div onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}>
        <SearchBox value={term} onChange={search} placeholder={t("searchPlaceholder")} className="sm:w-full" />
      </div>

      {filtered.length === 0 ? (
        <ListEmpty
          title={t("noResultsTitle")}
          hint={t("noResultsHint")}
          action={
            <Button variant="outline" onClick={() => search("")}>
              {tList("clearSearch")}
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-lg border">
            {rows.map((vehicle) => (
              <li key={vehicle.id}>
                {/* The label names the checkbox with the whole row and makes the row toggle it. */}
                <label className="flex items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={chosen.has(vehicle.id)}
                    onCheckedChange={(checked) => toggle(vehicle.id, checked)}
                  />
                  <VehicleRow vehicle={vehicle} className="flex-1" />
                </label>
              </li>
            ))}
          </ul>
          <PaginationBar page={page} pageSize={ASSIGN_PAGE_SIZE} total={filtered.length} onPageChange={setRequestedPage} />
        </>
      )}

      {message ? <FieldError errors={[{ message: messageText[message] }]} /> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving ? tCommon("saving") : t("submit", { count: selected.length })}
        </Button>
      </div>
    </form>
  );
}
