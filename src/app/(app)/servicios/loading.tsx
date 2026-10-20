import { getTranslations } from "next-intl/server";

import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { ServicesTableSkeleton } from "@/features/service/components/services-table";

export default async function ServicesLoading() {
  const t = await getTranslations("services");

  return (
    <>
      <PageHeader title={t("title")} description={<TextSkeleton className="w-56" />} />
      <ListToolbarSkeleton />
      <ServicesTableSkeleton />
    </>
  );
}
