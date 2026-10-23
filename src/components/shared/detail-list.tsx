import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DetailItem = {
  label: string;
  value: ReactNode;
  // In a two-column list, takes the whole row (a long text).
  wide?: boolean;
};

type DetailListProps = {
  items: readonly DetailItem[];
  // Label/value pairs two to a row from the `sm` breakpoint up, so the modal stays short.
  twoColumns?: boolean;
};

export function DetailList({ items, twoColumns = false }: DetailListProps) {
  return (
    <dl className={cn("flex flex-col gap-4", twoColumns && "sm:grid sm:grid-cols-2 sm:gap-x-6")}>
      {items.map(({ label, value, wide }) => (
        <div key={label} className={cn("flex min-w-0 flex-col gap-1", wide && "sm:col-span-2")}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="text-sm break-words whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
