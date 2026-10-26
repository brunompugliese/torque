import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CalendarSkeleton } from "@/components/shared/calendar";
import { ListSearchProvider } from "@/components/shared/list-search-provider";
import { ListToolbarSkeleton } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { AppointmentsPanel } from "@/features/appointment/components/appointments-panel";
import { AppointmentsCalendarSection } from "@/features/appointment/components/appointments-sections";
import { NewAppointmentButton } from "@/features/appointment/components/new-appointment-button";
import { JobsPanel } from "@/features/job/components/jobs-panel";
import { HomeJobsList } from "@/features/job/components/jobs-sections";
import { JobsTableSkeleton } from "@/features/job/components/jobs-table";
import { JOB_FILTER_KEYS } from "@/features/job/list";
import { requireSession } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/calendar";
import { parseListParams } from "@/lib/list/params";

import { HomeSummary } from "./_components/home-summary";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("home.title")} · ${t("app.name")}` };
}

// Inicio: the coming week of appointments and the open jobs, both reused from their own pages.
export default async function HomePage({ searchParams }: PageProps<"/inicio">) {
  await requireSession();
  const [t, params] = await Promise.all([
    getTranslations("home"),
    searchParams.then((raw) => parseListParams(raw, JOB_FILTER_KEYS)),
  ]);

  return (
    <ListSearchProvider>
      <JobsPanel>
        <AppointmentsPanel>
          <PageHeader
            title={t("title")}
            description={
              <Suspense fallback={<TextSkeleton className="w-64" />}>
                <HomeSummary />
              </Suspense>
            }
          />
          <div className="flex flex-col gap-8">
            <section aria-labelledby="home-appointments" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <h2 id="home-appointments" className="text-xl font-semibold">
                  {t("appointments.title")}
                </h2>
                <NewAppointmentButton />
              </div>
              {/* The week is not kept in the URL: the jobs list owns the address bar here. */}
              <Suspense fallback={<CalendarSkeleton />}>
                <AppointmentsCalendarSection
                  state={{ view: "week", anchor: todayIsoDate() }}
                  fixedView="week"
                  syncUrl={false}
                />
              </Suspense>
            </section>
            <section aria-labelledby="home-jobs" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <h2 id="home-jobs" className="text-xl font-semibold">
                  {t("jobs.title")}
                </h2>
              </div>
              <div>
                <Suspense
                  fallback={
                    <>
                      <ListToolbarSkeleton />
                      <JobsTableSkeleton />
                    </>
                  }
                >
                  <HomeJobsList params={params} />
                </Suspense>
              </div>
            </section>
          </div>
        </AppointmentsPanel>
      </JobsPanel>
    </ListSearchProvider>
  );
}
