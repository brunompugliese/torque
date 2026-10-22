import { describe, expect, it } from "vitest";

import { VIN_LENGTH, formatVinInput } from "./vin";

describe("formatVinInput", () => {
  it("uppercases and drops spaces and hyphens", () => {
    expect(formatVinInput("1hg-cm82633a-004352")).toBe("1HGCM82633A004352");
    expect(formatVinInput(" 1hg cm826 ")).toBe("1HGCM826");
  });

  it("holds at most 17 characters, counted after cleaning", () => {
    expect(VIN_LENGTH).toBe(17);
    expect(formatVinInput("1HG-CM82633A-004352-999")).toBe("1HGCM82633A004352");
  });

  it("is idempotent and keeps an empty value empty", () => {
    expect(formatVinInput("1HGCM82633A004352")).toBe("1HGCM82633A004352");
    expect(formatVinInput("")).toBe("");
  });
});
