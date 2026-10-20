import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";

import { DATE_FORMAT } from "./date";

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
