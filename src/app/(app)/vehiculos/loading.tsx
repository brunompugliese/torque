import { getTranslations } from "next-intl/server";

import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { VehiclesTableSkeleton } from "@/features/vehicle/components/vehicles-table";

export default async function VehiclesLoading() {
  const t = await getTranslations("vehicles");

  return (
    <>
      <PageHeader title={t("title")} description={<TextSkeleton className="w-56" />} />
      <ListToolbarSkeleton />
      <VehiclesTableSkeleton />
    </>
  );
}
