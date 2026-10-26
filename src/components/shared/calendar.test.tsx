import { act, fireEvent, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { Calendar, CalendarSkeleton, type CalendarItem } from "./calendar";

type Item = CalendarItem & { label: string };

const TODAY = "2026-10-14";

function item(id: string, date: string, time: string): Item {
  return { id, date, sortKey: time, label: `${time} ${id}` };
}

type HarnessProps = {
  items?: Item[];
  view?: "month" | "week";
  views?: readonly ("month" | "week")[];
  anchor?: string;
  loading?: boolean;
  errorSlot?: ReactNode;
  onCreate?: (date: string) => void;
  onViewChange?: (view: "month" | "week", anchor: string) => void;
  onAnchorChange?: (anchor: string) => void;
  onOpen?: (id: string) => void;
  openDay?: string | null;
  focusItemId?: string | null;
};

function Harness({
  items = [],
  view = "month",
  views,
  anchor = "2026-10-01",
  loading,
  errorSlot,
  onCreate = () => {},
  onViewChange = () => {},
  onAnchorChange = () => {},
  onOpen = () => {},
  openDay: initialOpenDay = null,
  focusItemId,
}: HarnessProps) {
  const [openDay, setOpenDay] = useState<string | null>(initialOpenDay);
  return (
    <Calendar
      view={view}
      views={views}
      anchor={anchor}
      items={items}
      loading={loading}
      errorSlot={errorSlot}
      today={TODAY}
      onViewChange={onViewChange}
      onAnchorChange={onAnchorChange}
      renderItem={(entry) => (
        <button type="button" data-item-id={entry.id} onClick={() => onOpen(entry.id)}>
          {entry.label}
        </button>
      )}
      renderPopoverItem={(entry) => (
        <button type="button" data-item-id={entry.id} onClick={() => onOpen(entry.id)}>
          {`lista ${entry.label}`}
        </button>
      )}
      onCreate={onCreate}
      createLabel={(date) => `Nuevo el ${date}`}
      openDay={openDay}
      onOpenDayChange={setOpenDay}
      focusItemId={focusItemId}
      legend={<p>Leyenda</p>}
    />
  );
}

describe("Calendar header", () => {
  it("titles the month with its first and last day and marks the month view", () => {
    renderWithIntl(<Harness />);
    expect(screen.getByRole("heading", { name: "01/10/2026 al 31/10/2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "false");
  });

  it("titles the week with its seven days", () => {
    renderWithIntl(<Harness view="week" anchor="2026-10-12" />);
    expect(screen.getByRole("heading", { name: "12/10/2026 al 18/10/2026" })).toBeInTheDocument();
  });

  it("announces the range it shows", () => {
    renderWithIntl(<Harness />);
    expect(screen.getByText("Mostrando del 01/10/2026 al 31/10/2026")).toBeInTheDocument();
  });

  it("switches view keeping a sensible anchor", () => {
    const onViewChange = vi.fn();
    renderWithIntl(<Harness onViewChange={onViewChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    // Today (14/10) is in the month shown: the week starts at today.
    expect(onViewChange).toHaveBeenCalledWith("week", TODAY);
  });

  it("does nothing when the current view is chosen again", () => {
    const onViewChange = vi.fn();
    renderWithIntl(<Harness onViewChange={onViewChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mes" }));
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("moves a month with the arrows and a week in the week view", () => {
    const onAnchorChange = vi.fn();
    const { unmount } = renderWithIntl(<Harness onAnchorChange={onAnchorChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    expect(onAnchorChange.mock.calls).toEqual([["2026-11-01"], ["2026-09-01"]]);
    unmount();

    const onWeekChange = vi.fn();
    renderWithIntl(<Harness view="week" anchor="2026-10-14" onAnchorChange={onWeekChange} />);
    fireEvent.click(screen.getByRole("button", { name: "7 días siguientes" }));
    fireEvent.click(screen.getByRole("button", { name: "7 días anteriores" }));
    expect(onWeekChange.mock.calls).toEqual([["2026-10-21"], ["2026-10-07"]]);
  });

  it("disables Hoy while the view already holds today, and goes back to it otherwise", () => {
    const onAnchorChange = vi.fn();
    const { unmount } = renderWithIntl(<Harness anchor="2026-10-01" />);
    expect(screen.getByRole("button", { name: "Hoy" })).toBeDisabled();
    unmount();

    renderWithIntl(<Harness anchor="2026-11-01" onAnchorChange={onAnchorChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(onAnchorChange).toHaveBeenCalledWith("2026-10-01");
  });

  it("goes back to today in the week view", () => {
    const onAnchorChange = vi.fn();
    renderWithIntl(<Harness view="week" anchor="2026-10-21" onAnchorChange={onAnchorChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(onAnchorChange).toHaveBeenCalledWith(TODAY);
  });

  it("draws no view toggle when the calendar has a single view, and keeps Hoy and the arrows", () => {
    const onAnchorChange = vi.fn();
    renderWithIntl(<Harness view="week" views={["week"]} anchor="2026-10-21" onAnchorChange={onAnchorChange} />);
    expect(screen.queryByRole("button", { name: "Mes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Semana" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "21/10/2026 al 27/10/2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    fireEvent.click(screen.getByRole("button", { name: "7 días siguientes" }));
    expect(onAnchorChange.mock.calls).toEqual([[TODAY], ["2026-10-28"]]);
  });

  it("shows the legend it is given", () => {
    renderWithIntl(<Harness />);
    expect(screen.getByText("Leyenda")).toBeInTheDocument();
  });
});

describe("Calendar month view", () => {
  it("has Monday-first weekday labels", () => {
    renderWithIntl(<Harness />);
    const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((name) => screen.getByText(name));
    expect(labels).toHaveLength(7);
  });

  it("greys the days of the neighbouring months and marks today", () => {
    renderWithIntl(<Harness />);
    expect(screen.getByRole("group", { name: "28/09/2026" })).toHaveClass("text-muted-foreground");
    expect(screen.getByRole("group", { name: "05/10/2026" })).not.toHaveClass("text-muted-foreground");
    const today = within(screen.getByRole("group", { name: "14/10/2026" })).getByText("14");
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveClass("bg-primary");
  });

  it("lists a day's items in time order", () => {
    renderWithIntl(<Harness items={[item("b", "2026-10-05", "15:00"), item("a", "2026-10-05", "09:00")]} />);
    const buttons = within(screen.getByRole("group", { name: "05/10/2026" })).getAllByRole("button", { name: /^\d\d:\d\d/ });
    expect(buttons.map((button) => button.textContent)).toEqual(["09:00 a", "15:00 b"]);
  });

  it("opens an item", () => {
    const onOpen = vi.fn();
    renderWithIntl(<Harness items={[item("a", "2026-10-05", "09:00")]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "09:00 a" }));
    expect(onOpen).toHaveBeenCalledWith("a");
  });

  it("shows three items and '+N más' for the rest", () => {
    const items = ["08:00", "09:00", "10:00", "11:00", "12:00"].map((time) => item(`i${time}`, "2026-10-05", time));
    renderWithIntl(<Harness items={items} />);
    const day = screen.getByRole("group", { name: "05/10/2026" });
    expect(within(day).getAllByRole("listitem")).toHaveLength(3);
    expect(within(day).getByRole("button", { name: "+2 más" })).toBeInTheDocument();
  });

  it("shows no '+N más' when the day has three or fewer", () => {
    const items = ["08:00", "09:00", "10:00"].map((time) => item(`i${time}`, "2026-10-05", time));
    renderWithIntl(<Harness items={items} />);
    expect(screen.queryByRole("button", { name: /más/ })).toBeNull();
  });
});

describe("Calendar '+N más' list", () => {
  const items = ["08:00", "09:00", "10:00", "11:00"].map((time) => item(`i${time}`, "2026-10-05", time));

  it("opens a list titled with the day's date holding all its items", async () => {
    renderWithIntl(<Harness items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "+1 más" }));
    expect(await screen.findByText("05/10/2026", { selector: "[data-slot=popover-title]" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^lista / })).toHaveLength(4);
  });

  it("closes with its X", async () => {
    renderWithIntl(<Harness items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "+1 más" }));
    await screen.findAllByRole("button", { name: /^lista / });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("button", { name: /^lista / })).toBeNull();
  });

  it("closes when the page scrolls, but not when the list itself does", async () => {
    renderWithIntl(<Harness items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "+1 más" }));
    const first = await screen.findByRole("button", { name: "lista 08:00 i08:00" });

    act(() => {
      first.parentElement?.parentElement?.dispatchEvent(new Event("scroll", { bubbles: false }));
    });
    expect(screen.getByRole("button", { name: "lista 08:00 i08:00" })).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    expect(screen.queryByRole("button", { name: "lista 08:00 i08:00" })).toBeNull();
  });

  it("opens an item from the list", async () => {
    const onOpen = vi.fn();
    renderWithIntl(<Harness items={items} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "+1 más" }));
    fireEvent.click(await screen.findByRole("button", { name: "lista 11:00 i11:00" }));
    expect(onOpen).toHaveBeenCalledWith("i11:00");
  });

  it("can be opened by its host and focuses the item it is told to", async () => {
    renderWithIntl(<Harness items={items} openDay="2026-10-05" focusItemId="i11:00" />);
    const target = await screen.findByRole("button", { name: "lista 11:00 i11:00" });
    expect(target).toHaveFocus();
  });
});

describe("Calendar days", () => {
  it("are all clickable, so the pointer is a hand over the whole day, not only over the '+'", () => {
    renderWithIntl(<Harness />);
    for (const name of ["05/10/2026", "28/09/2026", "14/10/2026"]) {
      expect(screen.getByRole("group", { name })).toHaveAttribute("data-clickable");
    }
  });

  it("are tall by default in the month and the week view", () => {
    const { unmount } = renderWithIntl(<Harness />);
    expect(screen.getByRole("group", { name: "05/10/2026" })).toHaveClass("min-h-32");
    unmount();

    renderWithIntl(<Harness view="week" anchor="2026-10-14" />);
    expect(screen.getByRole("group", { name: "14/10/2026" })).toHaveClass("min-h-32", "sm:min-h-48");
  });
});

describe("Calendar creating", () => {
  it("creates from a day's '+' button", () => {
    const onCreate = vi.fn();
    renderWithIntl(<Harness onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo el 2026-10-07" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith("2026-10-07");
  });

  it("creates from an empty spot of a day", () => {
    const onCreate = vi.fn();
    renderWithIntl(<Harness onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("group", { name: "08/10/2026" }));
    expect(onCreate).toHaveBeenCalledWith("2026-10-08");
  });

  it("does not create when the '+N más' list is clicked outside its buttons", async () => {
    const onCreate = vi.fn();
    const items = ["08:00", "09:00", "10:00", "11:00"].map((time) => item(`i${time}`, "2026-10-05", time));
    renderWithIntl(<Harness items={items} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "+1 más" }));

    const title = await screen.findByText("05/10/2026", { selector: "[data-slot=popover-title]" });
    fireEvent.click(title);
    fireEvent.click(title.closest("[data-slot=popover-content]") as HTMLElement);

    expect(onCreate).not.toHaveBeenCalled();
    // The day itself still creates.
    fireEvent.click(screen.getByRole("group", { name: "05/10/2026" }));
    expect(onCreate).toHaveBeenCalledWith("2026-10-05");
  });

  it("does not create when an item is clicked", () => {
    const onCreate = vi.fn();
    renderWithIntl(<Harness onCreate={onCreate} items={[item("a", "2026-10-05", "09:00")]} />);
    fireEvent.click(screen.getByRole("button", { name: "09:00 a" }));
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("Calendar week view", () => {
  it("shows seven days from the anchor with their weekday and every item", () => {
    const items = ["08:00", "09:00", "10:00", "11:00"].map((time) => item(`i${time}`, "2026-10-14", time));
    renderWithIntl(<Harness view="week" anchor="2026-10-14" items={items} />);
    const days = ["14/10/2026", "15/10/2026", "16/10/2026", "17/10/2026", "18/10/2026", "19/10/2026", "20/10/2026"];
    for (const name of days) expect(screen.getByRole("group", { name })).toBeInTheDocument();
    const first = screen.getByRole("group", { name: "14/10/2026" });
    expect(within(first).getByText("Mié")).toBeInTheDocument();
    expect(within(first).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /más/ })).toBeNull();
  });

  it("lists five records and '+N más' for the rest, opening the same list as the month", async () => {
    const items = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"].map((time) =>
      item(`i${time}`, "2026-10-14", time),
    );
    renderWithIntl(<Harness view="week" anchor="2026-10-14" items={items} />);
    const first = screen.getByRole("group", { name: "14/10/2026" });
    expect(within(first).getAllByRole("listitem")).toHaveLength(5);

    fireEvent.click(within(first).getByRole("button", { name: "+2 más" }));
    expect(await screen.findByText("14/10/2026", { selector: "[data-slot=popover-title]" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^lista / })).toHaveLength(7);
  });
});

describe("Calendar loading and errors", () => {
  it("keeps the grid and announces the loading once, without the items", () => {
    renderWithIntl(<Harness loading items={[item("a", "2026-10-05", "09:00")]} />);
    expect(screen.getAllByText("Cargando…")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "09:00 a" })).toBeNull();
    expect(screen.getByRole("group", { name: "05/10/2026" })).toBeInTheDocument();
    expect(document.querySelector("[aria-busy=true]")).not.toBeNull();
  });

  it("shows the error slot instead of the grid", () => {
    renderWithIntl(<Harness errorSlot={<p>No pudimos cargar</p>} />);
    expect(screen.getByText("No pudimos cargar")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "05/10/2026" })).toBeNull();
  });
});

describe("CalendarSkeleton", () => {
  it("is one busy region that announces loading once", () => {
    renderWithIntl(<CalendarSkeleton />);
    expect(screen.getAllByText("Cargando…")).toHaveLength(1);
    expect(document.querySelector("[aria-busy=true]")).not.toBeNull();
  });
});
