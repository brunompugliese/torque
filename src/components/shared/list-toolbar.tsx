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
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  filters?: ReactNode;
};

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  showArchived,
  onShowArchivedChange,
  filters,
}: ListToolbarProps) {
  const t = useTranslations("list");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-4">
      <SearchBox value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
      {filters}
      <label className="flex items-center gap-2 text-sm font-medium">
        <Switch checked={showArchived} onCheckedChange={(checked) => onShowArchivedChange(checked)} />
        {t("showArchived")}
      </label>
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
