import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";

import { DATE_FORMAT, maxVehicleYear } from "./date";

const format = createFormatter({ locale: "es" });

describe("DATE_FORMAT", () => {
  it("formats as dd/mm/aaaa", () => {
    expect(format.dateTime(new Date("2026-10-13T15:00:00Z"), DATE_FORMAT)).toBe("13/10/2026");
  });

  it("uses Argentina's day, not UTC's", () => {
    // Still the 13th in Argentina (UTC−3).
    expect(format.dateTime(new Date("2026-10-14T01:30:00Z"), DATE_FORMAT)).toBe("13/10/2026");
  });
});

describe("maxVehicleYear", () => {
  it("is next year", () => {
    expect(maxVehicleYear(new Date("2026-06-15T12:00:00Z"))).toBe(2027);
  });

  it("follows Argentina's calendar at the year boundary", () => {
    // Already 2027 in UTC, still 31/12/2026 in Argentina (UTC−3).
    expect(maxVehicleYear(new Date("2027-01-01T01:00:00Z"))).toBe(2027);
    expect(maxVehicleYear(new Date("2027-01-01T03:00:00Z"))).toBe(2028);
  });
});
