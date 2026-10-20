import { describe, expect, it } from "vitest";

import { normalizeSearch, toSearchPattern } from "./normalize";

describe("normalizeSearch", () => {
  // Same cases as the pgTAP tests, so app and database agree.
  it.each([
    ["  CAMBIO de  aceíte ", "cambiodeaceite"],
    ["Cambio-de.aceite", "cambiodeaceite"],
    ["Alineación y Balanceo", "alineacionybalanceo"],
    ["Suárez", "suarez"],
    ["ae 482-kd", "ae482kd"],
    ["35.123.456", "35123456"],
    ["Ñandú", "nandu"],
    ["Línea\tnueva\nfin", "lineanuevafin"],
    ["", ""],
  ])("%j → %j", (value, expected) => {
    expect(normalizeSearch(value)).toBe(expected);
  });
});

describe("toSearchPattern", () => {
  it("wraps the normalized term for a contains search", () => {
    expect(toSearchPattern(" Alineación ")).toBe("%alineacion%");
  });

  it("returns null for an empty or punctuation-only term", () => {
    expect(toSearchPattern("")).toBeNull();
    expect(toSearchPattern(" .- ")).toBeNull();
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(toSearchPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
