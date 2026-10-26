import { getTranslations } from "next-intl/server";

import { getAppointmentCountInRange } from "@/features/appointment/queries";
import { getOpenJobCount } from "@/features/job/queries";
import { addDays, todayIsoDate } from "@/lib/calendar";

// "3 turnos en los próximos 7 días, 12 trabajos abiertos.": today and the next 6 days, whatever
// week the calendar below is showing.
export async function HomeSummary() {
  const today = todayIsoDate();
  const [t, appointments, jobs] = await Promise.all([
    getTranslations("home"),
    getAppointmentCountInRange(today, addDays(today, 6)),
    getOpenJobCount(),
  ]);
  if (!appointments.ok || !jobs.ok) return null;
  return <p>{t("summary", { appointments: appointments.total, jobs: jobs.total })}</p>;
}
