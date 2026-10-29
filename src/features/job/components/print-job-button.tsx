"use client";

import { PrinterIcon } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

// Same size and focus ring as "Enviar presupuesto", in the neutral color.
const PRINT_BUTTON_CLASS =
  "inline-flex h-7 items-center gap-1.5 rounded-lg border border-transparent px-2 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

// The sheet's page: spec 013. Opened in a new tab, it prints by itself. A link, not an action: the
// job doesn't change (no status, no history entry).
export function printJobPath(jobId: string): string {
  return `/imprimir/${jobId}`;
}

type PrintJobButtonProps = {
  jobId: string;
  // True while the job's services load: the sheet is built from the saved job, so it waits for them.
  loading: boolean;
};

// "Imprimir": opens the job's printable sheet, for a job in any status, archived or not.
export function PrintJobButton({ jobId, loading }: PrintJobButtonProps) {
  const t = useTranslations("jobs.print");
  const icon = <PrinterIcon aria-hidden="true" className="size-4" />;

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className={cn(PRINT_BUTTON_CLASS, "pointer-events-none cursor-default text-muted-foreground opacity-70 hover:bg-transparent")}
      >
        {icon}
        {t("button")}
      </button>
    );
  }

  return (
    <a href={printJobPath(jobId)} target="_blank" rel="noopener noreferrer" className={PRINT_BUTTON_CLASS}>
      {icon}
      {t("button")}
    </a>
  );
}
