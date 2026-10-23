import { describe, expect, it } from "vitest";

import { formatKm, formatKmInput } from "./km";

describe("formatKmInput", () => {
  it.each([
    ["", ""],
    ["68400", "68.400"],
    ["68.400", "68.400"],
    ["68 400 km", "68.400"],
    ["12,5", "125"],
    ["abc", ""],
    ["123456789012", "1.234.567.890"],
  ])("cleans %j to %j", (input, expected) => {
    expect(formatKmInput(input)).toBe(expected);
  });
});

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
