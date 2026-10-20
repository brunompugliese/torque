import { getTranslations } from "next-intl/server";

import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { ClientsTableSkeleton } from "@/features/client/components/clients-table";

export default async function ClientsLoading() {
  const t = await getTranslations("clients");

  return (
    <>
      <PageHeader title={t("title")} description={<TextSkeleton className="w-56" />} />
      <ListToolbarSkeleton />
      <ClientsTableSkeleton />
    </>
  );
}
