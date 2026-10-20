import type { ReactNode } from "react";

export type DetailItem = {
  label: string;
  value: ReactNode;
};

export function DetailList({ items }: { items: readonly DetailItem[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="text-sm break-words whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
