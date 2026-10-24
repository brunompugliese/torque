"use client";

import { XIcon } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";

export type FilterChip = {
  id: string;
  // "Entregado", "Actualizado: 01/09/2026 al 30/09/2026"
  label: string;
  // Says what removing it does: "Quitar filtro: Entregado"
  removeLabel: string;
};

// The active filters as removable chips under the toolbar. Nothing renders
// without chips, so the toolbar doesn't grow an empty row.
export function FilterChips({ chips, onRemove }: { chips: readonly FilterChip[]; onRemove: (id: string) => void }) {
  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2 pb-4">
      {chips.map((chip) => (
        <li key={chip.id}>
          <Badge variant="secondary" className="h-6 gap-1 pr-1 text-xs">
            {chip.label}
            <button
              type="button"
              aria-label={chip.removeLabel}
              onClick={() => onRemove(chip.id)}
              className="grid size-4 place-content-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon aria-hidden="true" weight="bold" className="size-3" />
            </button>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
