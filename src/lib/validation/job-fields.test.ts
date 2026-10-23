import { describe, expect, it } from "vitest";

import { KILOMETERS_MAX, kilometersField, quantityField } from "./job-fields";

function message(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0].message;
}

describe("kilometersField", () => {
  it.each([
    ["68400", 68400],
    ["68.400", 68400],
    [" 0 ", 0],
    [68400, 68400],
  ])("reads %j as %d", (value, expected) => {
    expect(kilometersField.parse(value)).toBe(expected);
  });

  it.each([[""], ["  "], [null], [undefined]])("treats %j as no kilometers", (value) => {
    expect(kilometersField.parse(value)).toBeNull();
  });

  it.each([["12,5"], ["-1"], ["abc"], ["1e5"], [String(KILOMETERS_MAX + 1)], [1.5]])("rejects %j", (value) => {
    expect(message(kilometersField.safeParse(value))).toBe("kilometersInvalid");
  });

  it("accepts the largest database integer", () => {
    expect(kilometersField.parse(String(KILOMETERS_MAX))).toBe(KILOMETERS_MAX);
  });
});

describe("quantityField", () => {
  it.each([
    ["1", 1],
    [" 12 ", 12],
    [3, 3],
  ])("reads %j as %d", (value, expected) => {
    expect(quantityField.parse(value)).toBe(expected);
  });

  it.each([[""], ["0"], ["-1"], ["1,5"], ["abc"], [0], [1.5]])("rejects %j", (value) => {
    expect(message(quantityField.safeParse(value))).toBe("quantityInvalid");
  });

  it("rejects a missing quantity", () => {
    expect(message(quantityField.safeParse(undefined))).toBe("quantityInvalid");
  });
});
