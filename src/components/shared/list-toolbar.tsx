"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { LoadingRegion } from "./loading-region";
import { SearchBox } from "./search-box";

type ListToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  // Without a handler the archived switch isn't drawn (a page that never lists archived records).
  showArchived?: boolean;
  onShowArchivedChange?: (value: boolean) => void;
  filters?: ReactNode;
  // Page actions (the "add" button), pushed to the end of the row.
  actions?: ReactNode;
};

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  showArchived = false,
  onShowArchivedChange,
  filters,
  actions,
}: ListToolbarProps) {
  const t = useTranslations("list");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-4">
      <SearchBox value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
      {filters}
      {onShowArchivedChange ? (
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={showArchived} onCheckedChange={(checked) => onShowArchivedChange(checked)} />
          {t("showArchived")}
        </label>
      ) : null}
      {actions ? <div className="ml-auto">{actions}</div> : null}
    </div>
  );
}

export function ListToolbarSkeleton() {
  return (
    <LoadingRegion>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-4">
        <Skeleton className="h-9 w-full sm:w-96" />
        <Skeleton className="h-5 w-40" />
      </div>
    </LoadingRegion>
  );
}
