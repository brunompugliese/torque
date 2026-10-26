import { describe, expect, it } from "vitest";

import { calendarKey, parseCalendarState, toCalendarSearch } from "./calendar-params";

const TODAY = "2026-10-14";

describe("parseCalendarState", () => {
  it("is the month of today with no params", () => {
    expect(parseCalendarState({}, TODAY)).toEqual({ view: "month", anchor: "2026-10-01" });
  });

  it("reads the week and its first day", () => {
    expect(parseCalendarState({ vista: "semana", fecha: "2026-10-19" }, TODAY)).toEqual({
      view: "week",
      anchor: "2026-10-19",
    });
  });

  it("starts the week today without a date", () => {
    expect(parseCalendarState({ vista: "semana" }, TODAY)).toEqual({ view: "week", anchor: TODAY });
  });

  it("keeps the month of any day it is given", () => {
    expect(parseCalendarState({ fecha: "2026-12-25" }, TODAY)).toEqual({ view: "month", anchor: "2026-12-01" });
  });

  it("falls back to the defaults for anything invalid", () => {
    expect(parseCalendarState({ vista: "ano", fecha: "ayer" }, TODAY)).toEqual({ view: "month", anchor: "2026-10-01" });
    expect(parseCalendarState({ fecha: "2026-02-30" }, TODAY)).toEqual({ view: "month", anchor: "2026-10-01" });
  });

  it("takes the first of a repeated param and works with URLSearchParams", () => {
    expect(parseCalendarState({ vista: ["semana", "mes"] }, TODAY).view).toBe("week");
    expect(parseCalendarState(new URLSearchParams("vista=semana&fecha=2026-11-02"), TODAY)).toEqual({
      view: "week",
      anchor: "2026-11-02",
    });
  });
});

describe("toCalendarSearch", () => {
  it("is empty at the defaults", () => {
    expect(toCalendarSearch({ view: "month", anchor: "2026-10-01" }, TODAY)).toBe("");
    expect(toCalendarSearch({ view: "week", anchor: TODAY }, TODAY)).toBe("vista=semana");
  });

  it("writes only what is not the default", () => {
    expect(toCalendarSearch({ view: "month", anchor: "2026-11-01" }, TODAY)).toBe("fecha=2026-11-01");
    expect(toCalendarSearch({ view: "week", anchor: "2026-10-21" }, TODAY)).toBe("vista=semana&fecha=2026-10-21");
  });

  it("round-trips through parse", () => {
    const state = { view: "week", anchor: "2026-10-21" } as const;
    expect(parseCalendarState(new URLSearchParams(toCalendarSearch(state, TODAY)), TODAY)).toEqual(state);
  });
});

describe("calendarKey", () => {
  it("tells one range from another", () => {
    expect(calendarKey({ view: "month", anchor: "2026-10-01" })).not.toBe(calendarKey({ view: "week", anchor: "2026-10-01" }));
  });
});
