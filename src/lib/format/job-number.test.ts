import { describe, expect, it } from "vitest";

import { formatJobNumber } from "./job-number";

describe("formatJobNumber", () => {
  it.each([
    [1, "N° 000001"],
    [123, "N° 000123"],
    [99999, "N° 099999"],
    [123456, "N° 123456"],
    [1234567, "N° 1234567"],
  ])("formats %j as %j", (number, expected) => {
    expect(formatJobNumber(number)).toBe(expected);
  });
});
