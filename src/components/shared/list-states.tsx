"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ListEmptyProps = {
  title: string;
  hint: string;
  action?: ReactNode;
};

export function ListEmpty({ title, hint, action }: ListEmptyProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-xl border bg-card px-6 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

type ListErrorProps = {
  onRetry: () => void;
};

export function ListError({ onRetry }: ListErrorProps) {
  const t = useTranslations("list");

  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border bg-card px-6 py-12 text-center">
      <p className="text-base font-semibold">{t("errorTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("errorHint")}</p>
      <div className="pt-2">
        <Button variant="outline" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
