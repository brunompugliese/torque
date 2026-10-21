import { describe, expect, it } from "vitest";

import { formatPhone, phoneDigits } from "./phone";

describe("phoneDigits", () => {
  it("keeps only the digits", () => {
    expect(phoneDigits("(11) 1234-5678")).toBe("1112345678");
    expect(phoneDigits("abc")).toBe("");
  });

  it("drops leading zeros but not the others", () => {
    expect(phoneDigits("011 4444-5555")).toBe("1144445555");
    expect(phoneDigits("000")).toBe("");
    expect(phoneDigits("2901 10 2030")).toBe("2901102030");
  });
});

describe("formatPhone", () => {
  it.each([
    ["1112345678", "11 1234-5678"],
    ["2211234567", "221 123-4567"],
    ["3511234567", "351 123-4567"],
    ["2966123456", "2966 12-3456"],
  ])("formats %s as %s (2, 3 and 4 digit area codes)", (digits, formatted) => {
    expect(formatPhone(digits)).toBe(formatted);
  });

  it("formats as the user types, one digit at a time", () => {
    const steps = ["1", "11", "111", "1112", "11123", "1112345", "11123456", "111234567", "1112345678"];
    expect(steps.map(formatPhone)).toEqual([
      "1",
      "11",
      "11 1",
      "11 12",
      "11 123",
      "11 1234-5",
      "11 1234-56",
      "11 1234-567",
      "11 1234-5678",
    ]);
  });

  it("accepts digits only: anything else is dropped", () => {
    expect(formatPhone("11a12-34/56.78")).toBe("11 1234-5678");
    expect(formatPhone("abc")).toBe("");
    expect(formatPhone("")).toBe("");
  });

  it("drops a leading 0", () => {
    expect(formatPhone("011 4444-5555")).toBe("11 4444-5555");
    expect(formatPhone("0")).toBe("");
  });

  it("holds at most 10 digits", () => {
    expect(formatPhone("111234567899")).toBe("11 1234-5678");
    expect(phoneDigits(formatPhone("111234567899"))).toHaveLength(10);
  });

  it("leaves an area code the formatter doesn't know as plain digits", () => {
    expect(formatPhone("4444555566")).toBe("4444555566");
  });

  it("is idempotent, so a stored value can be formatted again", () => {
    for (const value of ["11 1234-5678", "221 123-4567", "2966 12-3456", "11 12", "4444555566"]) {
      expect(formatPhone(value)).toBe(value);
    }
  });

  it("formats a phone stored the old way", () => {
    expect(formatPhone("11 12345678")).toBe("11 1234-5678");
  });
});
