import { describe, expect, it } from "vitest";

import { DNI_MAX_DIGITS, dniDigits, formatDni } from "./dni";

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

describe("dniDigits", () => {
  it("keeps only the digits", () => {
    expect(dniDigits("28.456.123")).toBe("28456123");
    expect(dniDigits(" 28 a456-123 ")).toBe("28456123");
    expect(dniDigits("abc")).toBe("");
    expect(dniDigits("")).toBe("");
  });

  it("holds at most 8 digits", () => {
    expect(DNI_MAX_DIGITS).toBe(8);
    expect(dniDigits("284561239999")).toBe("28456123");
    expect(dniDigits("28.456.123.999")).toBe("28456123");
    expect(dniDigits("")).toBe("");
  });
});
