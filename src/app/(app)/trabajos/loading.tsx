import { getTranslations } from "next-intl/server";

import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { JobsTableSkeleton } from "@/features/job/components/jobs-table";

export default async function JobsLoading() {
  const t = await getTranslations("jobs");

  return (
    <>
      <PageHeader title={t("title")} description={<TextSkeleton className="w-56" />} />
      <ListToolbarSkeleton />
      <JobsTableSkeleton />
    </>
  );
}
