import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";

export default async function VehiclesPage() {
  const t = await getTranslations("nav");

  return <PageHeader title={t("vehicles")} />;
}
