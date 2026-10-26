"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { AppointmentStatusBadge, JobStatusBadge } from "@/components/shared/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { APPOINTMENT_STATUSES, JOB_STATUSES, type AppointmentStatus, type JobStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

type StatusPillSelectProps<Status extends string> = {
  status: Status;
  statuses: readonly Status[];
  onChange: (next: Status) => void;
  // The text of a status, for the list and for the pill's accessible name.
  labelOf: (status: Status) => string;
  // The status as its pill, with the dropdown arrow it must draw inside.
  badge: (status: Status, trailing: ReactNode) => ReactNode;
  // What a screen reader says about the pill ("Cambiar estado").
  label: string;
  disabled?: boolean;
  className?: string;
};

// A status pill as a dropdown with every status, its arrow inside the pill. The pill keeps its own colors; the list is
// the app's neutral one (primary), so the options don't compete with the status colors.
function StatusPillSelect<Status extends string>({
  status,
  statuses,
  onChange,
  labelOf,
  badge,
  label,
  disabled = false,
  className,
}: StatusPillSelectProps<Status>) {
  return (
    <Select
      value={status}
      disabled={disabled}
      onValueChange={(next) => {
        if (next && next !== status) onChange(next as Status);
      }}
      items={statuses.map((value) => ({ value, label: labelOf(value) }))}
    >
      <SelectTrigger
        icon={false}
        aria-label={`${label}: ${labelOf(status)}`}
        className={cn(
          "h-auto w-auto gap-1 rounded-full border-0 bg-transparent p-0 text-xs data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-transparent",
          className,
        )}
      >
        {badge(status, <CaretDownIcon aria-hidden="true" />)}
      </SelectTrigger>
      <SelectContent>
        {statuses.map((value) => (
          <SelectItem key={value} value={value}>
            {labelOf(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type StatusSelectProps<Status extends string> = {
  status: Status;
  onChange: (next: Status) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

// A job's status as a dropdown of the seven statuses.
export function StatusSelect(props: StatusSelectProps<JobStatus>) {
  const t = useTranslations("status.job");
  return (
    <StatusPillSelect
      {...props}
      statuses={JOB_STATUSES}
      labelOf={(status) => t(status)}
      badge={(status, trailing) => <JobStatusBadge status={status} trailing={trailing} />}
    />
  );
}

// An appointment's status as a dropdown of the four statuses.
export function AppointmentStatusSelect(props: StatusSelectProps<AppointmentStatus>) {
  const t = useTranslations("status.appointment");
  return (
    <StatusPillSelect
      {...props}
      statuses={APPOINTMENT_STATUSES}
      labelOf={(status) => t(status)}
      badge={(status, trailing) => <AppointmentStatusBadge status={status} trailing={trailing} />}
    />
  );
}
