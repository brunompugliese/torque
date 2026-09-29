import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";

export default async function JobsPage() {
  const t = await getTranslations("nav");

  return <PageHeader title={t("jobs")} />;
}
