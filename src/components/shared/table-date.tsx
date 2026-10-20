"use client";

import { useFormatter } from "next-intl";

import { DATE_FORMAT } from "@/lib/format/date";

export function TableDate({ value }: { value: string | Date }) {
  const format = useFormatter();
  return (
    <span className="whitespace-nowrap text-muted-foreground tabular-nums">
      {format.dateTime(new Date(value), DATE_FORMAT)}
    </span>
  );
}
