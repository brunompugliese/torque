"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { SearchableSelect, type SelectOption } from "@/components/shared/searchable-select";
import { useRemoteOptions } from "@/hooks/use-remote-options";
import { formatPlate } from "@/lib/format/plate";

import { searchVehicleOptions } from "../actions";

// What the dropdown needs to know about a vehicle.
export type VehicleChoice = { id: string; plate: string; brandName: string; modelName: string; enabled: boolean };

type VehicleSelectProps = {
  id: string;
  // The chosen vehicle's id, "" when none.
  value: string;
  onChange: (vehicleId: string) => void;
  // The record's own vehicle: listed and chosen from the start even if it was archived since.
  current?: VehicleChoice;
  // The text in the box, for a form that tells "typed but not chosen" from "empty".
  onTextChange?: (text: string) => void;
  invalid?: boolean;
  describedBy?: string;
};

// The vehicle dropdown of the job and appointment forms: active vehicles found on the server as
// the user types (plate, brand, model), "Brand Model" with the plate in grey, and once chosen
// "Fiat Cronos (AD 915 TB)". No quick create (docs/design.md#quick-create-inside-a-dropdown).
export function VehicleSelect({ id, value, onChange, current, onTextChange, invalid, describedBy }: VehicleSelectProps) {
  const t = useTranslations("vehicleSelect");

  const toOption = useMemo(
    () =>
      (vehicle: VehicleChoice): SelectOption => {
        const name = `${vehicle.brandName} ${vehicle.modelName}`;
        const label = vehicle.enabled ? name : t("archived", { label: name });
        return {
          value: vehicle.id,
          label,
          secondary: formatPlate(vehicle.plate),
          inputLabel: `${label} (${formatPlate(vehicle.plate)})`,
        };
      },
    [t],
  );

  const [picked, setPicked] = useState<SelectOption | null>(current ? toOption(current) : null);
  const [text, setText] = useState(picked?.inputLabel ?? "");

  const search = useRemoteOptions(text.trim(), async (term) => {
    const result = await searchVehicleOptions(term, current?.id);
    return result.ok ? result.rows : null;
  });
  const options = useMemo(() => search.rows.map(toOption), [search.rows, toOption]);

  return (
    <SearchableSelect
      id={id}
      options={options}
      selectedOption={picked ?? undefined}
      value={value}
      onValueChange={(next) => {
        setPicked(options.find((candidate) => candidate.value === next) ?? (picked?.value === next ? picked : null));
        onChange(next);
      }}
      inputValue={text}
      onInputValueChange={(next) => {
        setText(next);
        onTextChange?.(next);
      }}
      filter="remote"
      loading={search.loading}
      placeholder={t("placeholder")}
      emptyText={t("noOptions")}
      invalid={invalid}
      describedBy={describedBy}
    />
  );
}
