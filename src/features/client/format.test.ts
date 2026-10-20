import { describe, expect, it } from "vitest";

import { formatClientName } from "./format";

describe("formatClientName", () => {
  it("joins name and surname", () => {
    expect(formatClientName({ name: "Ana", surname: "Gómez" })).toBe("Ana Gómez");
  });

  it("shows only the name without a surname", () => {
    expect(formatClientName({ name: "Zoe", surname: null })).toBe("Zoe");
  });
});
