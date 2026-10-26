"use client";

import { CaretLeftIcon, CaretRightIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { LoadingRegion } from "@/components/shared/loading-region";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isAtToday,
  monthGrid,
  normalizeAnchor,
  periodRange,
  shiftAnchor,
  switchView,
  todayIsoDate,
  weekDays,
  weekdayIndex,
  type CalendarView,
} from "@/lib/calendar";
import { formatIsoDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";

// What the calendar needs to place and order a record: the day it falls on and a key that sorts the
// day's records. Everything else is the caller's (it draws the records).
export type CalendarItem = { id: string; date: string; sortKey: string };

// A day lists this many records, then "+N más": a month day is small, a week day has more room.
export const MONTH_DAY_LIMIT = 3;
export const WEEK_DAY_LIMIT = 5;

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const ALL_VIEWS: readonly CalendarView[] = ["month", "week"];

type CalendarProps<Item extends CalendarItem> = {
  view: CalendarView;
  // The views the user can switch between (both by default). With only one, the toggle isn't drawn.
  views?: readonly CalendarView[];
  // The month's first day, or the week's first day.
  anchor: string;
  items: readonly Item[];
  // The records of the new range are on their way: the grid stays, its days show placeholders.
  loading?: boolean;
  // Shown instead of the grid (an error with "Reintentar").
  errorSlot?: ReactNode;
  today?: string;
  onViewChange: (view: CalendarView, anchor: string) => void;
  onAnchorChange: (anchor: string) => void;
  // A record as a day shows it (one line in the month, a card in the week): a button the caller styles.
  renderItem: (item: Item) => ReactNode;
  // A record as the "+N más" list shows it. Its button carries `data-item-id` so focus can return to it.
  renderPopoverItem: (item: Item) => ReactNode;
  onCreate: (date: string) => void;
  // "Nuevo turno el 14/10/2026": the accessible name of a day's "+" button.
  createLabel: (date: string) => string;
  // The day whose "+N más" list is open, owned by the caller so it can reopen it.
  openDay: string | null;
  onOpenDayChange: (day: string | null) => void;
  // The record to focus when the list opens.
  focusItemId?: string | null;
  legend?: ReactNode;
};

function groupByDay<Item extends CalendarItem>(items: readonly Item[]): Map<string, Item[]> {
  const days = new Map<string, Item[]>();
  for (const item of items) days.set(item.date, [...(days.get(item.date) ?? []), item]);
  for (const list of days.values()) list.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));
  return days;
}

export function Calendar<Item extends CalendarItem>({
  view,
  views = ALL_VIEWS,
  anchor,
  items,
  loading = false,
  errorSlot,
  today = todayIsoDate(),
  onViewChange,
  onAnchorChange,
  renderItem,
  renderPopoverItem,
  onCreate,
  createLabel,
  openDay,
  onOpenDayChange,
  focusItemId,
  legend,
}: CalendarProps<Item>) {
  const t = useTranslations("calendar");
  const days = useMemo(() => groupByDay(items), [items]);
  const period = periodRange(view, anchor);
  const range = t("period", { from: formatIsoDate(period.from), to: formatIsoDate(period.to) });
  const atToday = isAtToday(view, anchor, today);

  const dayProps = {
    view,
    today,
    days,
    loading,
    renderItem,
    renderPopoverItem,
    onCreate,
    createLabel,
    openDay,
    onOpenDayChange,
    focusItemId,
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4" aria-label={range}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tabular-nums">{range}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {views.length > 1 ? (
            <div role="group" aria-label={t("viewLabel")} className="inline-flex gap-0.5 rounded-lg border p-0.5">
              {views.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={view === option ? "default" : "ghost"}
                  aria-pressed={view === option}
                  onClick={() => {
                    if (view !== option) onViewChange(option, switchView(option, anchor, today));
                  }}
                >
                  {t(option)}
                </Button>
              ))}
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={atToday}
            onClick={() => onAnchorChange(normalizeAnchor(view, today))}
          >
            {t("today")}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={t(view === "month" ? "previousMonth" : "previousWeek")}
              onClick={() => onAnchorChange(shiftAnchor(view, anchor, -1))}
            >
              <CaretLeftIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={t(view === "month" ? "nextMonth" : "nextWeek")}
              onClick={() => onAnchorChange(shiftAnchor(view, anchor, 1))}
            >
              <CaretRightIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <p role="status" className="sr-only">
        {t("announce", { from: formatIsoDate(period.from), to: formatIsoDate(period.to) })}
      </p>

      {errorSlot ?? (
        <div aria-busy={loading || undefined} className="overflow-x-auto">
          {loading ? (
            <span role="status" className="sr-only">
              {t("loading")}
            </span>
          ) : null}
          {view === "month" ? <MonthGrid anchor={anchor} {...dayProps} /> : <WeekGrid anchor={anchor} {...dayProps} />}
        </div>
      )}

      {legend}
    </section>
  );
}

type GridProps<Item extends CalendarItem> = {
  anchor: string;
  view: CalendarView;
  today: string;
  days: Map<string, Item[]>;
  loading: boolean;
  renderItem: (item: Item) => ReactNode;
  renderPopoverItem: (item: Item) => ReactNode;
  onCreate: (date: string) => void;
  createLabel: (date: string) => string;
  openDay: string | null;
  onOpenDayChange: (day: string | null) => void;
  focusItemId?: string | null;
};

function MonthGrid<Item extends CalendarItem>(props: GridProps<Item>) {
  const t = useTranslations("calendar");
  const weeks = monthGrid(props.anchor);

  return (
    <div className="min-w-xl">
      <div className="grid grid-cols-7 gap-px pb-1">
        {WEEKDAY_KEYS.map((key) => (
          <div key={key} className="px-1.5 text-xs font-medium text-muted-foreground">
            {t(`weekdays.${key}`)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {weeks.flatMap((week) =>
          week.map((cell) => <DayCell key={cell.date} date={cell.date} muted={!cell.inMonth} limit={MONTH_DAY_LIMIT} {...props} />),
        )}
      </div>
    </div>
  );
}

function WeekGrid<Item extends CalendarItem>(props: GridProps<Item>) {
  const t = useTranslations("calendar");

  return (
    <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-7">
      {weekDays(props.anchor).map((date) => (
        <DayCell
          key={date}
          date={date}
          muted={false}
          limit={WEEK_DAY_LIMIT}
          weekday={t(`weekdays.${WEEKDAY_KEYS[weekdayIndex(date)]}`)}
          {...props}
        />
      ))}
    </div>
  );
}

type DayCellProps<Item extends CalendarItem> = GridProps<Item> & {
  date: string;
  muted: boolean;
  // How many records the day lists before "+N más".
  limit: number;
  // The week view names the weekday above the number.
  weekday?: string;
};

function DayCell<Item extends CalendarItem>({
  date,
  muted,
  limit,
  weekday,
  today,
  days,
  loading,
  renderItem,
  renderPopoverItem,
  onCreate,
  createLabel,
  openDay,
  onOpenDayChange,
  focusItemId,
}: DayCellProps<Item>) {
  const t = useTranslations("calendar");
  const items = days.get(date) ?? [];
  const shown = items.slice(0, limit);
  const hidden = items.length - shown.length;
  const isToday = date === today;

  return (
    <div
      role="group"
      aria-label={formatIsoDate(date)}
      data-clickable
      className={cn(
        "group flex flex-col gap-1 bg-card p-1.5",
        // Taller than their content, so a day is a target and not just a number.
        weekday ? "min-h-32 sm:min-h-48" : "min-h-32",
        muted && "bg-muted/50 text-muted-foreground",
      )}
      onClick={(event) => {
        // Only the empty part of the day creates: its records and buttons do their own thing, and the
        // "+N más" list is portaled out of the day but still its child for React, so its clicks bubble here.
        if (!event.currentTarget.contains(event.target as Node)) return;
        if ((event.target as HTMLElement).closest("button, a")) return;
        onCreate(date);
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5">
          {weekday ? <span className="text-xs font-medium text-muted-foreground">{weekday}</span> : null}
          <time
            dateTime={date}
            aria-current={isToday ? "date" : undefined}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
              isToday && "bg-primary font-semibold text-primary-foreground",
            )}
          >
            {Number(date.slice(8))}
          </time>
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={createLabel(date)}
          className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          onClick={() => onCreate(date)}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      </div>

      {loading ? (
        <div aria-hidden="true" className="flex flex-col gap-1">
          {Array.from({ length: weekday ? 2 : 1 }, (_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {shown.map((item) => (
              <li key={item.id}>{renderItem(item)}</li>
            ))}
          </ul>
          {hidden > 0 ? (
            <Popover open={openDay === date} onOpenChange={(open) => onOpenDayChange(open ? date : null)}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="self-start rounded px-1 text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  />
                }
              >
                {t("more", { count: hidden })}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <DayList
                  title={formatIsoDate(date)}
                  onClose={() => onOpenDayChange(null)}
                  focusItemId={focusItemId}
                  closeLabel={t("close")}
                >
                  {items.map((item) => (
                    <li key={item.id}>{renderPopoverItem(item)}</li>
                  ))}
                </DayList>
              </PopoverContent>
            </Popover>
          ) : null}
        </>
      )}
    </div>
  );
}

// The open "+N más" list: titled with the day, it closes with its X, Esc, a click outside or any
// scroll of the page (the list's own scroll excepted).
function DayList({
  title,
  onClose,
  focusItemId,
  closeLabel,
  children,
}: {
  title: string;
  onClose: () => void;
  focusItemId?: string | null;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [onClose]);

  useEffect(() => {
    if (!focusItemId) return;
    const target = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-item-id]") ?? []).find(
      (element) => element.dataset.itemId === focusItemId,
    );
    target?.focus();
  }, [focusItemId]);

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <PopoverTitle className="tabular-nums">{title}</PopoverTitle>
        <Button type="button" size="icon-xs" variant="ghost" aria-label={closeLabel} onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">{children}</ul>
    </div>
  );
}

// The calendar's shape while the page loads: the header's blocks and a month of empty days.
export function CalendarSkeleton() {
  return (
    <LoadingRegion className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-8 w-72" />
        </div>
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-none" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
