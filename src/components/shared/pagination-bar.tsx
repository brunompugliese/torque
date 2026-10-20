"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { pageCount, pageRange, pageWindow } from "@/lib/list/pagination";

type PaginationBarProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function PaginationBar({ page, pageSize, total, onPageChange }: PaginationBarProps) {
  const t = useTranslations("list");
  if (total === 0) return null;

  const pages = pageCount(total, pageSize);
  const { from, to } = pageRange(page, pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <p aria-live="polite">{t("range", { from, to, total })}</p>
      {pages > 1 ? (
        <nav aria-label={t("pagination")} className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {t("previous")}
          </Button>
          {pageWindow(page, pages).map((item, index) =>
            item === "gap" ? (
              <span key={`gap-${index}`} aria-hidden="true" className="px-1">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "default" : "ghost"}
                size="icon-sm"
                aria-label={t("goToPage", { page: item })}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            {t("next")}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
