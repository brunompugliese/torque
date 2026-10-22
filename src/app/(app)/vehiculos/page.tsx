import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ListSearchProvider } from "@/components/shared/list-search-provider";
import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { AddVehicleButton } from "@/features/vehicle/components/add-vehicle-button";
import { VehiclesList, VehiclesSummary } from "@/features/vehicle/components/vehicles-sections";
import { VehiclesPanel } from "@/features/vehicle/components/vehicles-panel";
import { VehiclesTableSkeleton } from "@/features/vehicle/components/vehicles-table";
import { requireSession } from "@/lib/auth/session";
import { parseListParams } from "@/lib/list/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("vehicles.title")} · ${t("app.name")}` };
}

export default async function VehiclesPage({ searchParams }: PageProps<"/vehiculos">) {
  await requireSession();
  const [t, params] = await Promise.all([getTranslations("vehicles"), searchParams.then(parseListParams)]);

  return (
    <ListSearchProvider>
      <VehiclesPanel>
        <PageHeader
          title={t("title")}
          description={
            <Suspense fallback={<TextSkeleton className="w-56" />}>
              <VehiclesSummary />
            </Suspense>
          }
          actions={<AddVehicleButton />}
        />
        <Suspense
          fallback={
            <>
              <ListToolbarSkeleton />
              <VehiclesTableSkeleton />
            </>
          }
        >
          <VehiclesList params={params} />
        </Suspense>
      </VehiclesPanel>
    </ListSearchProvider>
  );
}
