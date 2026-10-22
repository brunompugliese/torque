import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { toFieldErrors } from "./fields";
import { VEHICLE_MIN_YEAR, plateField, vinField, yearField } from "./vehicle-fields";

function parse(field: z.ZodType, value: unknown) {
  const result = z.object({ value: field }).safeParse({ value });
  return result.success
    ? { value: (result.data as { value: unknown }).value }
    : { error: toFieldErrors<"value">(result.error).value };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("plateField", () => {
  it.each([[""], ["   "], ["--"], [undefined]])("requires a plate for %j", (plate) => {
    expect(parse(plateField, plate)).toEqual({ error: "plateRequired" });
  });

  it.each([["A"], ["AB 12"], ["abc12"], ["AB123CDE"], ["ABC 123 45"]])("rejects %j: not 6 or 7 characters", (plate) => {
    expect(parse(plateField, plate)).toEqual({ error: "plateInvalid" });
  });

  it("stores 6 or 7 letters and digits, uppercase and unspaced, however they were typed", () => {
    expect(parse(plateField, "ab 123 cd")).toEqual({ value: "AB123CD" });
    expect(parse(plateField, " abc-123 ")).toEqual({ value: "ABC123" });
    expect(parse(plateField, "A123BCD")).toEqual({ value: "A123BCD" });
  });

  it("is idempotent: a stored plate passes again unchanged", () => {
    expect(parse(plateField, "AB123CD")).toEqual({ value: "AB123CD" });
  });
});

describe("yearField", () => {
  it.each([[""], ["  "], [null], [undefined]])("accepts %j as no year", (year) => {
    expect(parse(yearField, year)).toEqual({ value: null });
  });

  it("accepts a whole number, typed or already a number", () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z") });
    expect(parse(yearField, "2021")).toEqual({ value: 2021 });
    expect(parse(yearField, 2021)).toEqual({ value: 2021 });
    expect(parse(yearField, " 2021 ")).toEqual({ value: 2021 });
  });

  it("accepts the first year and next year, and nothing outside them", () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z") });
    expect(VEHICLE_MIN_YEAR).toBe(1886);
    expect(parse(yearField, "1886")).toEqual({ value: 1886 });
    expect(parse(yearField, "2027")).toEqual({ value: 2027 });
    expect(parse(yearField, "1885")).toEqual({ error: "yearInvalid" });
    expect(parse(yearField, "2028")).toEqual({ error: "yearInvalid" });
  });

  it.each([["20.5"], ["abc"], ["-2000"], ["2e3"], [2021.5]])("rejects %j: not a whole number", (year) => {
    vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z") });
    expect(parse(yearField, year)).toEqual({ error: "yearInvalid" });
  });

  it("moves its upper bound with the Argentine calendar", () => {
    vi.useFakeTimers({ now: new Date("2027-01-01T03:30:00Z") });
    expect(parse(yearField, "2028")).toEqual({ value: 2028 });
  });
});

describe("vinField", () => {
  it.each([[""], ["   "], [null], [undefined]])("accepts %j as no VIN", (vin) => {
    expect(parse(vinField, vin)).toEqual({ value: null });
  });

  it("stores 17 letters and digits, trimmed, without hyphens, uppercase", () => {
    expect(parse(vinField, "1hgcm82633a004352")).toEqual({ value: "1HGCM82633A004352" });
    expect(parse(vinField, " 1hg-cm82633a-004352 ")).toEqual({ value: "1HGCM82633A004352" });
  });

  it.each([["1HGCM82633A00435"], ["1HGCM82633A0043522"], ["1HGCM82633A 04352"], ["1HGCM82633A00435$"]])(
    "rejects %j: not 17 letters and digits",
    (vin) => {
      expect(parse(vinField, vin)).toEqual({ error: "vinInvalid" });
    },
  );

  it.each([["I"], ["O"], ["Q"], ["i"]])("rejects the letter %j", (letter) => {
    expect(parse(vinField, `1HGCM82633A00435${letter}`)).toEqual({ error: "vinInvalid" });
  });
});
