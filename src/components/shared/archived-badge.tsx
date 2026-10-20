import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

export function ArchivedBadge() {
  const t = useTranslations("common");
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {t("archived")}
    </Badge>
  );
}
