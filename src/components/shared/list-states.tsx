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

type ListNoRowsProps = {
  // Why the list has no rows: a search with no match, a page with no records at
  // all, or only archived records while they are hidden.
  hasSearch: boolean;
  total: number;
  texts: {
    noResultsTitle: string;
    noResultsHint: string;
    noneTitle: string;
    noneHint: string;
    onlyArchivedTitle: string;
    onlyArchivedHint: string;
  };
  addLabel: string;
  onAdd: () => void;
  onClearSearch: () => void;
  // The clear button's text when it clears more than the search ("Limpiar búsqueda y filtros").
  clearLabel?: string;
  onShowArchived: () => void;
};

// The three empty states every list page shares (docs/design.md#list-pages).
export function ListNoRows({
  hasSearch,
  total,
  texts,
  addLabel,
  onAdd,
  onClearSearch,
  clearLabel,
  onShowArchived,
}: ListNoRowsProps) {
  const t = useTranslations("list");

  if (hasSearch) {
    return (
      <ListEmpty
        title={texts.noResultsTitle}
        hint={texts.noResultsHint}
        action={
          <Button variant="outline" onClick={onClearSearch}>
            {clearLabel ?? t("clearSearch")}
          </Button>
        }
      />
    );
  }
  if (total === 0) {
    return <ListEmpty title={texts.noneTitle} hint={texts.noneHint} action={<Button onClick={onAdd}>{addLabel}</Button>} />;
  }
  return (
    <ListEmpty
      title={texts.onlyArchivedTitle}
      hint={texts.onlyArchivedHint}
      action={
        <Button variant="outline" onClick={onShowArchived}>
          {t("showArchived")}
        </Button>
      }
    />
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
