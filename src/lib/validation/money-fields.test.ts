import { describe, expect, it } from "vitest";

import { moneyField, moneyInputText, parseMoney } from "./money-fields";

describe("parseMoney", () => {
  it.each([
    ["0", 0],
    ["12500", 12500],
    ["12500,5", 12500.5],
    ["12500,50", 12500.5],
    ["  300 ", 300],
  ])("reads %j as %d", (text, amount) => {
    expect(parseMoney(text)).toBe(amount);
  });

  it.each([[""], ["12.500"], ["12500,"], ["12500,505"], ["1,2,3"], ["-5"], ["abc"], ["$ 100"]])("rejects %j", (text) => {
    expect(parseMoney(text)).toBeNull();
  });
});

describe("moneyInputText", () => {
  it("shows a comma for decimals and none for whole amounts", () => {
    expect(moneyInputText(12500.5)).toBe("12500,5");
    expect(moneyInputText(605000)).toBe("605000");
  });
});

describe("moneyField", () => {
  it("turns the typed text into a number", () => {
    expect(moneyField.parse("12500,50")).toBe(12500.5);
    expect(moneyField.parse("605000")).toBe(605000);
  });

  it("allows zero", () => {
    expect(moneyField.parse("0")).toBe(0);
  });

  it("accepts a number from the database", () => {
    expect(moneyField.parse(12500.5)).toBe(12500.5);
  });

  it.each([[""], ["   "]])("asks for the price when %j", (value) => {
    const result = moneyField.safeParse(value);
    expect(result.success ? null : result.error.issues[0].message).toBe("priceRequired");
  });

  it("asks for the price when it is missing", () => {
    const result = moneyField.safeParse(undefined);
    expect(result.success ? null : result.error.issues[0].message).toBe("priceRequired");
  });

  it.each([["12.500"], ["abc"], ["1,234"], ["-1"]])("rejects %j as invalid", (value) => {
    const result = moneyField.safeParse(value);
    expect(result.success ? null : result.error.issues[0].message).toBe("priceInvalid");
  });
});
