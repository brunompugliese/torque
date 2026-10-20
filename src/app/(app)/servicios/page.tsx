import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { AddServiceButton } from "@/features/service/components/add-service-button";
import { ServicesPanel } from "@/features/service/components/services-panel";
import { ServicesCount, ServicesList, ServicesSummary } from "@/features/service/components/services-sections";
import { ServicesTableSkeleton } from "@/features/service/components/services-table";
import { ServicesToolbar } from "@/features/service/components/services-toolbar";
import { requireSession } from "@/lib/auth/session";
import { parseListParams, toListSearch } from "@/lib/list/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("services.title")} · ${t("app.name")}` };
}

export default async function ServicesPage({ searchParams }: PageProps<"/servicios">) {
  await requireSession();
  const [t, params] = await Promise.all([getTranslations("services"), searchParams.then(parseListParams)]);
  // A new key per list state shows the skeleton again while results load.
  const listKey = toListSearch(params);

  return (
    <ServicesPanel>
      <PageHeader
        title={t("title")}
        description={
          <Suspense fallback={<TextSkeleton className="w-56" />}>
            <ServicesSummary />
          </Suspense>
        }
        actions={<AddServiceButton />}
      />
      <ServicesToolbar
        count={
          <Suspense key={listKey} fallback={<TextSkeleton className="w-28" />}>
            <ServicesCount params={params} />
          </Suspense>
        }
      />
      <Suspense key={listKey} fallback={<ServicesTableSkeleton />}>
        <ServicesList params={params} />
      </Suspense>
    </ServicesPanel>
  );
}
