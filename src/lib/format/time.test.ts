import { describe, expect, it } from "vitest";

import { isTime, normalizeTime } from "./time";

describe("normalizeTime", () => {
  it("drops the seconds the database adds", () => {
    expect(normalizeTime("09:00:00")).toBe("09:00");
    expect(normalizeTime("23:45")).toBe("23:45");
  });
});

describe("isTime", () => {
  it("accepts 24 h times only", () => {
    expect(isTime("00:00")).toBe(true);
    expect(isTime("23:59")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(isTime("9:00")).toBe(false);
    expect(isTime("09:60")).toBe(false);
  });
});
