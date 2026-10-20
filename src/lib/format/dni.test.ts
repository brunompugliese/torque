import { describe, expect, it } from "vitest";

import { formatDni } from "./dni";

describe("formatDni", () => {
  it.each([
    ["28456123", "28.456.123"],
    ["9123456", "9.123.456"],
    ["123", "123"],
    ["1234", "1.234"],
    ["", ""],
  ])("formats %j as %j", (dni, expected) => {
    expect(formatDni(dni)).toBe(expected);
  });

  it("is idempotent", () => {
    expect(formatDni("28.456.123")).toBe("28.456.123");
  });
});
