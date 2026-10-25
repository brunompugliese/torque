"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Calendar } from "@/components/shared/calendar";
import { ListError } from "@/components/shared/list-states";
import { useListResults } from "@/hooks/use-list-results";
import { anchorForDate, normalizeAnchor, todayIsoDate, visibleRange } from "@/lib/calendar";
import { formatIsoDate } from "@/lib/format/date";

import { searchAppointments } from "../actions";
import { calendarKey, toCalendarSearch, type CalendarState } from "../calendar-params";
import type { AppointmentRange } from "../queries";
import { AppointmentCard, AppointmentLegend } from "./appointment-card";
import { useAppointmentsPanel } from "./appointments-panel";

type AppointmentsCalendarProps = {
  // The first range, loaded on the server.
  initial: AppointmentRange;
  initialState: CalendarState;
};

// The Turnos calendar: the month or the week in the URL, the appointments of the days it shows, and
// the "+N más" list of a crowded day. Changing the range loads only that range.
export function AppointmentsCalendar({ initial, initialState }: AppointmentsCalendarProps) {
  const t = useTranslations("appointments");
  const panel = useAppointmentsPanel();

  const [state, setState] = useState<CalendarState>(initialState);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);

  const range = visibleRange(state.view, state.anchor);
  const { result, pending, retry } = useListResults(initial, calendarKey(initialState), calendarKey(state), () =>
    searchAppointments(range.from, range.to),
  );

  // What the panel tells us, in order: go to a saved day, reopen the list a modal was opened from.
  const [seenNonce, setSeenNonce] = useState(() => panel.signals.at(-1)?.nonce ?? 0);
  const unseen = panel.signals.filter((signal) => signal.nonce > seenNonce);
  if (unseen.length > 0) {
    setSeenNonce(unseen[unseen.length - 1].nonce);
    for (const signal of unseen) {
      if (signal.type === "saved") {
        setOpenDay(null);
        setFocusItemId(null);
        setState((current) => ({ ...current, anchor: anchorForDate(current.view, current.anchor, signal.date) }));
      } else {
        setOpenDay(signal.day);
        setFocusItemId(signal.itemId);
      }
    }
  }

  // The URL follows the calendar; the Back button keeps working because nothing is pushed.
  useEffect(() => {
    const search = toCalendarSearch(state, todayIsoDate());
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [state]);

  const items = useMemo(
    () => (result.ok ? result.rows.map((row) => ({ ...row, sortKey: `${row.time}|${row.createdAt}` })) : []),
    [result],
  );

  return (
    <Calendar
      view={state.view}
      anchor={state.anchor}
      items={items}
      loading={pending}
      errorSlot={!pending && !result.ok ? <ListError onRetry={retry} /> : undefined}
      onViewChange={(view, anchor) => {
        setOpenDay(null);
        setState({ view, anchor: normalizeAnchor(view, anchor) });
      }}
      onAnchorChange={(anchor) => {
        setOpenDay(null);
        setState((current) => ({ ...current, anchor }));
      }}
      renderItem={(item) => <AppointmentCard appointment={item} onOpen={() => panel.openAppointment(item)} />}
      renderPopoverItem={(item) => (
        <AppointmentCard
          appointment={item}
          variant="list"
          onOpen={() => {
            setOpenDay(null);
            panel.openAppointment(item, item.date);
          }}
        />
      )}
      onCreate={(date) => panel.openCreate(date)}
      createLabel={(date) => t("createOn", { date: formatIsoDate(date) })}
      openDay={openDay}
      onOpenDayChange={(day) => {
        setOpenDay(day);
        if (day === null) setFocusItemId(null);
      }}
      focusItemId={focusItemId}
      legend={<AppointmentLegend />}
    />
  );
}
