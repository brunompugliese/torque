import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";

import {
  DATE_FORMAT,
  argentinaDayStart,
  argentinaNextDayStart,
  formatDateTime,
  formatIsoDate,
  isIsoDate,
  maxVehicleYear,
} from "./date";

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

describe("isIsoDate", () => {
  it.each([["2026-09-01"], ["2028-02-29"]])("accepts %s", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each([["0002-02-20"], ["0020-02-20"], ["0202-02-20"], ["1899-12-31"]])(
    "rejects %s, a year still being typed",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );

  it("accepts the first day of 1900", () => {
    expect(isIsoDate("1900-01-01")).toBe(true);
  });

  it.each([["2026-02-30"], ["2026-13-01"], ["2026-9-1"], ["01/09/2026"], [""], ["2026-09-01T00:00"]])(
    "rejects %j",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

describe("formatIsoDate", () => {
  it("shows a picked day as dd/mm/aaaa", () => {
    expect(formatIsoDate("2026-09-01")).toBe("01/09/2026");
    expect(formatIsoDate("2026-12-31")).toBe("31/12/2026");
  });
});

describe("argentinaDayStart and argentinaNextDayStart", () => {
  it("start the day at 03:00 UTC (UTC−3, no daylight saving)", () => {
    expect(argentinaDayStart("2026-09-01")).toBe("2026-09-01T03:00:00.000Z");
    expect(argentinaDayStart("2026-01-15")).toBe("2026-01-15T03:00:00.000Z");
  });

  it("end a day where the next one starts, across month and year boundaries", () => {
    expect(argentinaNextDayStart("2026-09-30")).toBe("2026-10-01T03:00:00.000Z");
    expect(argentinaNextDayStart("2026-12-31")).toBe("2027-01-01T03:00:00.000Z");
    expect(argentinaNextDayStart("2028-02-28")).toBe("2028-02-29T03:00:00.000Z");
  });

  it("include a late evening in Argentina (already tomorrow in UTC) in its own day", () => {
    const evening = "2026-09-30T23:30:00.000Z"; // 20:30 on the 30th in Argentina
    expect(evening >= argentinaDayStart("2026-09-30")).toBe(true);
    expect(evening < argentinaNextDayStart("2026-09-30")).toBe(true);
  });
});

describe("formatDateTime", () => {
  it("is dd/mm/aaaa hh:mm in Argentina time", () => {
    expect(formatDateTime("2026-10-22T00:47:00Z")).toBe("21/10/2026 21:47");
    expect(formatDateTime(new Date("2026-10-22T15:05:00Z"))).toBe("22/10/2026 12:05");
  });

  it("shows midnight as 00:00, not 24:00", () => {
    expect(formatDateTime("2026-10-22T03:00:00Z")).toBe("22/10/2026 00:00");
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
