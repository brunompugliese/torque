import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type LoadingRegionProps = {
  children: ReactNode;
  className?: string;
};

export function LoadingRegion({ children, className }: LoadingRegionProps) {
  const t = useTranslations("common");

  return (
    <div aria-busy="true" className={cn("relative", className)} data-slot="loading-region">
      <span role="status" className="sr-only">
        {t("loading")}
      </span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
