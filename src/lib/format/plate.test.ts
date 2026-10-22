import { describe, expect, it } from "vitest";

import { PLATE_MAX_LENGTH, PLATE_MIN_LENGTH, formatPlate, formatPlateInput, plateCharacters } from "./plate";

describe("plateCharacters", () => {
  it("keeps letters and digits, uppercase", () => {
    expect(plateCharacters("ab 123-cd")).toBe("AB123CD");
    expect(plateCharacters(" a.b/1_2 ")).toBe("AB12");
    expect(plateCharacters("")).toBe("");
  });
});

describe("formatPlateInput", () => {
  it.each([
    ["", ""],
    ["a", "A"],
    ["ab", "AB"],
    ["ab1", "AB 1"],
    ["ab123", "AB 123"],
    ["ab123c", "AB 123 C"],
    ["ab123cd", "AB 123 CD"],
    ["abc", "ABC"],
    ["abc1", "ABC 1"],
    ["abc123", "ABC 123"],
  ])("shows %j as %j while typing", (typed, expected) => {
    expect(formatPlateInput(typed)).toBe(expected);
  });

  it("drops other characters and holds at most 7", () => {
    expect(PLATE_MIN_LENGTH).toBe(6);
    expect(PLATE_MAX_LENGTH).toBe(7);
    expect(formatPlateInput("ab-123.cd")).toBe("AB 123 CD");
    expect(formatPlateInput("ab123cdxyz")).toBe("AB 123 CD");
  });

  it("leaves unknown shapes unspaced, like formatPlate", () => {
    expect(formatPlateInput("a123bcd")).toBe("A123BCD");
    expect(formatPlate("a123bcd")).toBe("A123BCD");
  });

  it("is idempotent and agrees with formatPlate on finished plates", () => {
    expect(formatPlateInput("AB 123 CD")).toBe("AB 123 CD");
    expect(formatPlateInput("ABC 123")).toBe("ABC 123");
    for (const plate of ["AB123CD", "ABC123"]) expect(formatPlateInput(plate)).toBe(formatPlate(plate));
  });
});

describe("formatPlate", () => {
  it("spaces a Mercosur plate", () => {
    expect(formatPlate("AB123CD")).toBe("AB 123 CD");
  });

  it("spaces an old-format plate", () => {
    expect(formatPlate("ABC123")).toBe("ABC 123");
  });

  it("is idempotent and uppercases", () => {
    expect(formatPlate("AB 123 CD")).toBe("AB 123 CD");
    expect(formatPlate("ab123cd")).toBe("AB 123 CD");
  });

  it("shows any other value uppercase as stored", () => {
    expect(formatPlate("m123abc")).toBe("M123ABC");
    expect(formatPlate("")).toBe("");
  });
});
