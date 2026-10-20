import { describe, expect, it } from "vitest";

import { toFieldErrors } from "@/lib/validation/fields";

import { serviceFormSchema, serviceRowSchema } from "./schemas";

describe("serviceFormSchema", () => {
  it("tidies the name and the description", () => {
    expect(serviceFormSchema.parse({ name: "  Cambio   de aceite ", description: "  Incluye filtro.\nSin aceite. " })).toEqual({
      name: "Cambio de aceite",
      description: "Incluye filtro.\nSin aceite.",
    });
  });

  it("stores an empty description as null", () => {
    expect(serviceFormSchema.parse({ name: "Lavado", description: "   " }).description).toBeNull();
    expect(serviceFormSchema.parse({ name: "Lavado" }).description).toBeNull();
  });

  it.each([[""], ["   "], [undefined]])("requires a name (%j)", (name) => {
    const result = serviceFormSchema.safeParse({ name, description: "" });
    expect(result.success ? undefined : toFieldErrors(result.error).name).toBe("nameRequired");
  });

  it("has no length limits", () => {
    const long = "a".repeat(5000);
    expect(serviceFormSchema.parse({ name: long, description: long }).name).toHaveLength(5000);
  });
});

describe("serviceRowSchema", () => {
  it("maps a database row", () => {
    expect(
      serviceRowSchema.parse({
        id: "s1",
        name: "Lavado",
        description: null,
        enabled: true,
        created_at: "2026-10-13T15:00:00+00:00",
      }),
    ).toEqual({ id: "s1", name: "Lavado", description: null, enabled: true, createdAt: "2026-10-13T15:00:00+00:00" });
  });
});
