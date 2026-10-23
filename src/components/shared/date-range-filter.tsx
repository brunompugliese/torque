"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { isIsoDate } from "@/lib/format/date";

export type DateRange = { from: string; to: string };

type DateRangeFilterProps = {
  // Applied range as "yyyy-mm-dd" ("" = no bound).
  value: DateRange;
  // Called only with a valid range: each bound empty or a complete day, and "Desde" never later
  // than "Hasta".
  onChange: (range: DateRange) => void;
  fromLabel: string;
  toLabel: string;
  // "La fecha “Desde” no puede ser posterior a “Hasta”."
  orderError: string;
};

// "Desde" / "Hasta" day inputs. A range in the wrong order shows its error and is
// not applied, so the list never changes to an empty result by mistake.
export function DateRangeFilter({ value, onChange, fromLabel, toLabel, orderError }: DateRangeFilterProps) {
  const id = useId();
  const [draft, setDraft] = useState<DateRange>(value);
  const wrongOrder = draft.from !== "" && draft.to !== "" && draft.from > draft.to;

  // The applied range changed elsewhere (a chip was removed): follow it.
  const [seen, setSeen] = useState(value);
  if (seen.from !== value.from || seen.to !== value.to) {
    setSeen(value);
    setDraft(value);
  }

  function update(next: DateRange) {
    setDraft(next);
    // A date input passes through "0002-02-20" while the year is typed: wait for a complete day.
    if ((next.from !== "" && !isIsoDate(next.from)) || (next.to !== "" && !isIsoDate(next.to))) return;
    if (next.from !== "" && next.to !== "" && next.from > next.to) return;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-from`} className="text-[13px] font-medium">
          {fromLabel}
        </label>
        <Input
          id={`${id}-from`}
          type="date"
          value={draft.from}
          max={draft.to || undefined}
          aria-invalid={wrongOrder || undefined}
          aria-describedby={wrongOrder ? `${id}-error` : undefined}
          onChange={(event) => update({ ...draft, from: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-to`} className="text-[13px] font-medium">
          {toLabel}
        </label>
        <Input
          id={`${id}-to`}
          type="date"
          value={draft.to}
          min={draft.from || undefined}
          aria-invalid={wrongOrder || undefined}
          aria-describedby={wrongOrder ? `${id}-error` : undefined}
          onChange={(event) => update({ ...draft, to: event.target.value })}
        />
      </div>
      {wrongOrder ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {orderError}
        </p>
      ) : null}
    </div>
  );
}
