import { describe, expect, it } from "vitest";

import { formatKm } from "./km";

describe("formatKm", () => {
  it.each([
    [0, "0 km"],
    [850, "850 km"],
    [9500, "9.500 km"],
    [112500, "112.500 km"],
    [1234567, "1.234.567 km"],
  ])("formats %j as %j", (km, expected) => {
    expect(formatKm(km)).toBe(expected);
  });
});
