import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CalendarSkeleton } from "@/components/shared/calendar";
import { PageHeader } from "@/components/shared/page-header";
import { TextSkeleton } from "@/components/shared/text-skeleton";
import { parseCalendarState } from "@/features/appointment/calendar-params";
import { AppointmentsPanel } from "@/features/appointment/components/appointments-panel";
import {
  AppointmentsCalendarSection,
  AppointmentsSummary,
} from "@/features/appointment/components/appointments-sections";
import { NewAppointmentButton } from "@/features/appointment/components/new-appointment-button";
import { requireSession } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/calendar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("appointments.title")} · ${t("app.name")}` };
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/turnos">) {
  await requireSession();
  const [t, state] = await Promise.all([
    getTranslations("appointments"),
    searchParams.then((raw) => parseCalendarState(raw, todayIsoDate())),
  ]);

  return (
    <AppointmentsPanel>
      <PageHeader
        title={t("title")}
        description={
          <Suspense fallback={<TextSkeleton className="w-32" />}>
            <AppointmentsSummary />
          </Suspense>
        }
        actions={<NewAppointmentButton />}
      />
      <Suspense fallback={<CalendarSkeleton />}>
        <AppointmentsCalendarSection state={state} />
      </Suspense>
    </AppointmentsPanel>
  );
}
