import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth/session";

export default async function VehiclesPage() {
  await requireSession();
  const t = await getTranslations("nav");

  return <PageHeader title={t("vehicles")} />;
}
