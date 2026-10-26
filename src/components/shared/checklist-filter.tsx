"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export type ChecklistOption = {
  value: string;
  label: string;
  // What a screen reader hears instead of the label when it needs more words ("Entregado, últimos 30 días").
  accessibleLabel?: string;
  // How many records the option would list; undefined while counts load.
  count?: number;
};

type ChecklistFilterProps = {
  options: readonly ChecklistOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  // The counts are still loading: a skeleton stands in for each number.
  loadingCounts?: boolean;
  // What a screen reader hears once while they load ("Cargando…").
  loadingLabel?: string;
};

// A list of checkboxes with the number of records each choice would list.
// Selecting several lists records in any of them; the selection keeps the options' order.
export function ChecklistFilter({
  options,
  selected,
  onChange,
  loadingCounts = false,
  loadingLabel,
}: ChecklistFilterProps) {
  function toggle(value: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(value);
    else next.delete(value);
    onChange(options.map((option) => option.value).filter((optionValue) => next.has(optionValue)));
  }

  return (
    <ul className="flex flex-col gap-1" aria-busy={loadingCounts || undefined}>
      {loadingCounts && loadingLabel ? (
        <li role="status" className="sr-only">
          {loadingLabel}
        </li>
      ) : null}
      {options.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <li key={option.value}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
              <Checkbox checked={checked} onCheckedChange={(next) => toggle(option.value, next)} />
              {option.accessibleLabel ? (
                <>
                  <span aria-hidden="true" className="flex-1">
                    {option.label}
                  </span>
                  <span className="sr-only">{option.accessibleLabel}</span>
                </>
              ) : (
                <span className="flex-1">{option.label}</span>
              )}
              {loadingCounts ? (
                <Skeleton aria-hidden="true" className="h-4 w-6" />
              ) : option.count !== undefined ? (
                <span className="text-xs text-muted-foreground tabular-nums">{option.count}</span>
              ) : null}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
