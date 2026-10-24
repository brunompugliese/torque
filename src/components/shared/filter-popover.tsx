"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type FilterPopoverProps = {
  // "Estado", "Fecha"
  label: string;
  // Whether the filter is applied: the button shows it in the text color with a count or dot.
  active?: boolean;
  // How many choices are applied (shown next to the label, e.g. "Estado · 2").
  count?: number;
  // Clears this filter. The panel shows "Limpiar" only while the filter is active.
  onClear?: () => void;
  children: ReactNode;
};

// A toolbar button that opens a small panel with a filter's controls. Operable
// by keyboard (Enter/Space opens, Esc closes and returns focus to the button).
export function FilterPopover({ label, active = false, count, onClear, children }: FilterPopoverProps) {
  const t = useTranslations("list");

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" className="h-9 gap-1.5" data-active={active ? "true" : undefined} />}
      >
        {label}
        {count ? <span className="text-xs text-muted-foreground tabular-nums">· {count}</span> : null}
        <CaretDownIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-3 p-3">
        {children}
        {active && onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-end"
            aria-label={t("clearFilter", { filter: label })}
            onClick={onClear}
          >
            {t("clear")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
