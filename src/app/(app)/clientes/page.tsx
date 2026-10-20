import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { AddClientButton } from "@/features/client/components/add-client-button";
import { ClientsPanel } from "@/features/client/components/clients-panel";
import { ClientsList, ClientsSummary } from "@/features/client/components/clients-sections";
import { ClientsTableSkeleton } from "@/features/client/components/clients-table";
import { requireSession } from "@/lib/auth/session";
import { parseListParams } from "@/lib/list/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("clients.title")} · ${t("app.name")}` };
}

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  await requireSession();
  const [t, params] = await Promise.all([getTranslations("clients"), searchParams.then(parseListParams)]);

  return (
    <ClientsPanel>
      <PageHeader
        title={t("title")}
        description={
          <Suspense fallback={<TextSkeleton className="w-56" />}>
            <ClientsSummary />
          </Suspense>
        }
        actions={<AddClientButton />}
      />
      <Suspense
        fallback={
          <>
            <ListToolbarSkeleton />
            <ClientsTableSkeleton />
          </>
        }
      >
        <ClientsList params={params} />
      </Suspense>
    </ClientsPanel>
  );
}
