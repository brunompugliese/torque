"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

export function SearchBox({ value, onChange, placeholder, className }: SearchBoxProps) {
  const t = useTranslations("list");

  return (
    <div className={cn("relative w-full sm:w-96", className)}>
      <MagnifyingGlassIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={t("searchLabel")}
        className="h-9 bg-card pl-8"
      />
    </div>
  );
}
