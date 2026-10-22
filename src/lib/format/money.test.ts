import { describe, expect, it } from "vitest";

import { formatMoney } from "./money";

describe("formatMoney", () => {
  it.each([
    [0, "$ 0"],
    [950, "$ 950"],
    [605000, "$ 605.000"],
    [12500.5, "$ 12.500,50"],
    [12500.05, "$ 12.500,05"],
    [1234567.89, "$ 1.234.567,89"],
    [-1500, "-$ 1.500"],
  ])("formats %j as %j", (amount, expected) => {
    expect(formatMoney(amount)).toBe(expected);
  });

  it("rounds to two decimals", () => {
    expect(formatMoney(10.004)).toBe("$ 10");
    expect(formatMoney(10.006)).toBe("$ 10,01");
  });
});
