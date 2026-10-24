"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { JobStatusBadge } from "@/components/shared/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { JOB_STATUSES, type JobStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

type StatusSelectProps = {
  status: JobStatus;
  onChange: (next: JobStatus) => void;
  // What a screen reader says about the pill ("Cambiar estado").
  label: string;
  disabled?: boolean;
  className?: string;
};

// The status pill as a dropdown with every status, its arrow inside the pill. The pill keeps its own colors; the list is
// the app's neutral one (primary), so the options don't compete with the status colors.
export function StatusSelect({ status, onChange, label, disabled = false, className }: StatusSelectProps) {
  const t = useTranslations("status.job");

  return (
    <Select
      value={status}
      disabled={disabled}
      onValueChange={(next) => {
        if (next && next !== status) onChange(next as JobStatus);
      }}
      items={JOB_STATUSES.map((value) => ({ value, label: t(value) }))}
    >
      <SelectTrigger
        icon={false}
        aria-label={`${label}: ${t(status)}`}
        className={cn(
          "h-auto w-auto gap-1 rounded-full border-0 bg-transparent p-0 text-xs data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-transparent",
          className,
        )}
      >
        <JobStatusBadge status={status} trailing={<CaretDownIcon aria-hidden="true" />} />
      </SelectTrigger>
      <SelectContent>
        {JOB_STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            {t(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
