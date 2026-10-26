import { getTranslations } from "next-intl/server";

import { visibleRange, type CalendarView } from "@/lib/calendar";

import type { CalendarState } from "../calendar-params";
import { getAppointmentCounts, listAppointments } from "../queries";
import { AppointmentsCalendar } from "./appointments-calendar";

export async function AppointmentsSummary() {
  const [t, counts] = await Promise.all([getTranslations("appointments"), getAppointmentCounts()]);
  if (!counts.ok) return null;
  return <p>{t("summary", { total: counts.total })}</p>;
}

// The first render loads the range the URL asks for; later ranges load on the client.
// `fixedView` and `syncUrl` are for Inicio: the week only, and a URL that belongs to its jobs list.
export async function AppointmentsCalendarSection({
  state,
  fixedView,
  syncUrl,
}: {
  state: CalendarState;
  fixedView?: CalendarView;
  syncUrl?: boolean;
}) {
  const range = visibleRange(state.view, state.anchor);
  const initial = await listAppointments(range.from, range.to);
  return <AppointmentsCalendar initial={initial} initialState={state} fixedView={fixedView} syncUrl={syncUrl} />;
}
