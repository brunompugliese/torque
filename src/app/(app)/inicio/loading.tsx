import { getTranslations } from "next-intl/server";

import { CalendarSkeleton } from "@/components/shared/calendar";
import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { JobsTableSkeleton } from "@/features/job/components/jobs-table";

export default async function HomeLoading() {
  const t = await getTranslations("home");

  return (
    <>
      <PageHeader title={t("title")} description={<TextSkeleton className="w-64" />} />
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">{t("appointments.title")}</h2>
            <Skeleton className="h-10 w-36" />
          </div>
          <CalendarSkeleton />
        </section>
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">{t("jobs.title")}</h2>
            <Skeleton className="h-10 w-40" />
          </div>
          <div>
            <ListToolbarSkeleton />
            <JobsTableSkeleton />
          </div>
        </section>
      </div>
    </>
  );
}
