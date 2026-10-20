"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { LoadingRegion } from "./loading-region";

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
      <div className="relative w-full sm:w-96">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={t("searchLabel")}
          className="h-9 bg-card pl-8"
        />
      </div>
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
