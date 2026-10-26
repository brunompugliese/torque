import { getTranslations } from "next-intl/server";

import { CalendarSkeleton } from "@/components/shared/calendar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";

export default async function AppointmentsLoading() {
  const t = await getTranslations("appointments");

  return (
    <>
      <PageHeader title={t("title")} description={<TextSkeleton className="w-32" />} />
      <CalendarSkeleton />
    </>
  );
}
