import { describe, expect, it } from "vitest";

import { getSafeRedirectPath, resolveAuthRedirect } from "./redirects";

describe("getSafeRedirectPath", () => {
  it.each([
    ["/", "/"],
    ["/vehiculos", "/vehiculos"],
    ["/vehiculos/123?tab=historial", "/vehiculos/123?tab=historial"],
    ["/turnos#hoy", "/turnos#hoy"],
  ])("keeps %s", (input, expected) => {
    expect(getSafeRedirectPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "http://evil.example/vehiculos",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "vehiculos",
    "/\tevil.example",
    "/\nevil.example",
    "/ingresar",
    "/ingresar?next=/x",
    "/ingresar/",
    "/salir",
    "/salir?motivo=cuenta",
    "",
    "/" + "a".repeat(3000),
  ])("rejects %j", (input) => {
    expect(getSafeRedirectPath(input)).toBe("/");
  });

  it.each([undefined, null, 42, ["/vehiculos"], {}])("rejects non-strings (%j)", (input) => {
    expect(getSafeRedirectPath(input)).toBe("/");
  });

  it("keeps an encoded double slash inside the path (it stays same-origin)", () => {
    expect(getSafeRedirectPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
});

describe("resolveAuthRedirect", () => {
  it("lets signed-out visitors see the login page", () => {
    expect(resolveAuthRedirect("/ingresar", "", false)).toBeNull();
  });

  it("sends signed-in users away from the login page", () => {
    expect(resolveAuthRedirect("/ingresar", "?next=/x", true)).toEqual({ redirectTo: "/" });
  });

  it("lets signed-in users through everywhere else", () => {
    expect(resolveAuthRedirect("/vehiculos/1", "", true)).toBeNull();
    expect(resolveAuthRedirect("/no-existe", "", true)).toBeNull();
  });

  it.each([
    ["/vehiculos/123", "", "/ingresar?next=%2Fvehiculos%2F123"],
    ["/turnos", "?dia=hoy", "/ingresar?next=%2Fturnos%3Fdia%3Dhoy"],
    ["/no-existe", "", "/ingresar?next=%2Fno-existe"],
    ["/", "", "/ingresar"],
    ["/salir", "", "/ingresar"],
  ])("redirects signed-out visitors from %s%s", (pathname, search, expected) => {
    expect(resolveAuthRedirect(pathname, search, false)).toEqual({ redirectTo: expected });
  });
});
