import { describe, expect, it } from "vitest";

import { formatThousands } from "./number";

describe("formatThousands", () => {
  it.each([
    ["", ""],
    ["7", "7"],
    ["999", "999"],
    ["1000", "1.000"],
    ["9500", "9.500"],
    ["112500", "112.500"],
    ["1234567", "1.234.567"],
  ])("formats %j as %j", (digits, expected) => {
    expect(formatThousands(digits)).toBe(expected);
  });
});
