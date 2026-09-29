import { describe, expect, it } from "vitest";

import messages from "../../messages/es.json";
import { NAV_ITEMS, isNavItemActive } from "./navigation";

describe("isNavItemActive", () => {
  it.each([
    ["/", "/", true],
    ["/vehiculos", "/", false],
    ["/vehiculos", "/vehiculos", true],
    ["/vehiculos/123", "/vehiculos", true],
    ["/vehiculos/123/editar", "/vehiculos", true],
    ["/vehiculosx", "/vehiculos", false],
    ["/clientes", "/vehiculos", false],
    ["/vehiculos/", "/vehiculos", true],
    ["/vehiculos", "/vehiculos/", true],
  ])("pathname %s with href %s is %s", (pathname, href, expected) => {
    expect(isNavItemActive(pathname, href)).toBe(expected);
  });
});

describe("NAV_ITEMS", () => {
  it("lists the five sections in order", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/vehiculos",
      "/clientes",
      "/turnos",
      "/trabajos",
    ]);
  });

  it("has unique hrefs", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("has a Spanish label for every item", () => {
    for (const item of NAV_ITEMS) {
      expect(messages.nav[item.labelKey]).toEqual(expect.any(String));
    }
  });
});
