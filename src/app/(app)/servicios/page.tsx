import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { AddServiceButton } from "@/features/service/components/add-service-button";
import { ServicesPanel } from "@/features/service/components/services-panel";
import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { ServicesList, ServicesSummary } from "@/features/service/components/services-sections";
import { ServicesTableSkeleton } from "@/features/service/components/services-table";
import { requireSession } from "@/lib/auth/session";
import { parseListParams } from "@/lib/list/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("services.title")} · ${t("app.name")}` };
}

export default async function ServicesPage({ searchParams }: PageProps<"/servicios">) {
  await requireSession();
  const [t, params] = await Promise.all([getTranslations("services"), searchParams.then(parseListParams)]);

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
      <Suspense
        fallback={
          <>
            <ListToolbarSkeleton />
            <ServicesTableSkeleton />
          </>
        }
      >
        <ServicesList params={params} />
      </Suspense>
    </ServicesPanel>
  );
}
