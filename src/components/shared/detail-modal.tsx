"use client";

import { XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { LoadingRegion } from "./loading-region";

export type DetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  createdOn?: string;
  onBack?: () => void;
  footer?: ReactNode;
};

export function DetailModal({
  open,
  onOpenChange,
  title,
  badge,
  subtitle,
  actions,
  children,
  createdOn,
  onBack,
  footer,
}: DetailModalProps) {
  const t = useTranslations("common");

  const defaultFooter =
    createdOn || onBack ? (
      <div className="flex items-center justify-between gap-3">
        {createdOn ? <p className="text-xs text-muted-foreground">{t("createdOn", { date: createdOn })}</p> : <span />}
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            {t("back")}
          </Button>
        ) : null}
      </div>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-lg">
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-lg leading-tight font-semibold break-words">{title}</DialogTitle>
              {badge}
            </div>
            {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label={t("close")} />}>
              <XIcon aria-hidden="true" />
            </DialogClose>
          </div>
        </div>
        <div className="px-5 py-4">{children}</div>
        {(footer ?? defaultFooter) ? <div className="border-t px-5 py-3">{footer ?? defaultFooter}</div> : null}
      </DialogContent>
    </Dialog>
  );
}

export function DetailModalBodySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <LoadingRegion>
      <div className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
