import { describe, expect, it } from "vitest";

import {
  addDays,
  anchorForDate,
  addMonths,
  isAtToday,
  monthEnd,
  monthGrid,
  monthStart,
  normalizeAnchor,
  parseIsoDay,
  periodRange,
  shiftAnchor,
  switchView,
  todayIsoDate,
  visibleRange,
  weekDays,
  weekdayIndex,
} from "./calendar";

describe("todayIsoDate", () => {
  it("is the Argentine day, not the UTC one", () => {
    // 01:00 UTC is still the previous evening in Argentina (UTC−3).
    expect(todayIsoDate(new Date("2026-10-13T01:00:00Z"))).toBe("2026-10-12");
    expect(todayIsoDate(new Date("2026-10-13T03:00:00Z"))).toBe("2026-10-13");
  });
});

describe("day math", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("moves by months to the first day", () => {
    expect(addMonths("2026-10-15", 1)).toBe("2026-11-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-01");
  });

  it("finds the month's first and last days", () => {
    expect(monthStart("2026-10-15")).toBe("2026-10-01");
    expect(monthEnd("2026-10-15")).toBe("2026-10-31");
    expect(monthEnd("2024-02-10")).toBe("2024-02-29");
  });

  it("numbers weekdays from Monday", () => {
    expect(weekdayIndex("2026-10-12")).toBe(0);
    expect(weekdayIndex("2026-10-18")).toBe(6);
  });

  it("lists seven days from the start", () => {
    expect(weekDays("2026-10-12")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });
});

describe("monthGrid", () => {
  it("starts on Monday and ends on Sunday, greying the neighbouring months", () => {
    const grid = monthGrid("2026-10-15");
    expect(grid[0][0]).toEqual({ date: "2026-09-28", inMonth: false });
    expect(grid[0][3]).toEqual({ date: "2026-10-01", inMonth: true });
    const lastWeek = grid[grid.length - 1];
    expect(lastWeek[6]).toEqual({ date: "2026-11-01", inMonth: false });
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("has four weeks when February starts on Monday and has 28 days", () => {
    // February 2027 starts on a Monday.
    const grid = monthGrid("2027-02-10");
    expect(grid).toHaveLength(4);
    expect(grid.flat().every((cell) => cell.inMonth)).toBe(true);
  });

  it("has six weeks when the month spills over", () => {
    // August 2026 starts on a Saturday and has 31 days.
    expect(monthGrid("2026-08-10")).toHaveLength(6);
  });
});

describe("views", () => {
  it("normalizes the anchor", () => {
    expect(normalizeAnchor("month", "2026-10-15")).toBe("2026-10-01");
    expect(normalizeAnchor("week", "2026-10-15")).toBe("2026-10-15");
  });

  it("loads the greyed days of the month grid too", () => {
    expect(visibleRange("month", "2026-10-01")).toEqual({ from: "2026-09-28", to: "2026-11-01" });
    expect(visibleRange("week", "2026-10-12")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
  });

  it("names the period of the title", () => {
    expect(periodRange("month", "2026-10-01")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("week", "2026-10-12")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
  });

  it("moves a month or seven days", () => {
    expect(shiftAnchor("month", "2026-10-01", 1)).toBe("2026-11-01");
    expect(shiftAnchor("month", "2026-10-01", -1)).toBe("2026-09-01");
    expect(shiftAnchor("week", "2026-10-12", 1)).toBe("2026-10-19");
    expect(shiftAnchor("week", "2026-10-12", -1)).toBe("2026-10-05");
  });

  it("knows when it is already at today", () => {
    expect(isAtToday("month", "2026-10-01", "2026-10-25")).toBe(true);
    expect(isAtToday("month", "2026-11-01", "2026-10-25")).toBe(false);
    expect(isAtToday("week", "2026-10-25", "2026-10-25")).toBe(true);
    expect(isAtToday("week", "2026-10-19", "2026-10-25")).toBe(false);
  });
});

describe("switchView", () => {
  it("keeps the month when going to the month view", () => {
    expect(switchView("month", "2026-10-19", "2026-10-25")).toBe("2026-10-01");
  });

  it("starts the week at today when today is in the month shown, else at its first day", () => {
    expect(switchView("week", "2026-10-01", "2026-10-25")).toBe("2026-10-25");
    expect(switchView("week", "2026-11-01", "2026-10-25")).toBe("2026-11-01");
  });
});

describe("anchorForDate", () => {
  it("shows the month of the day", () => {
    expect(anchorForDate("month", "2026-10-01", "2026-12-25")).toBe("2026-12-01");
  });

  it("keeps the week when it already holds the day, else starts one on it", () => {
    expect(anchorForDate("week", "2026-10-14", "2026-10-20")).toBe("2026-10-14");
    expect(anchorForDate("week", "2026-10-14", "2026-10-21")).toBe("2026-10-21");
    expect(anchorForDate("week", "2026-10-14", "2026-10-01")).toBe("2026-10-01");
  });
});

describe("parseIsoDay", () => {
  it("accepts a real day only", () => {
    expect(parseIsoDay("2026-10-12")).toBe("2026-10-12");
    expect(parseIsoDay("2026-02-30")).toBeNull();
    expect(parseIsoDay("hoy")).toBeNull();
    expect(parseIsoDay(null)).toBeNull();
  });
});
