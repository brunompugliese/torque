import { describe, expect, it } from "vitest";

import { formatPlate } from "./plate";

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
