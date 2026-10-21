import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  dniField,
  idSchema,
  newPasswordField,
  optionalEmailField,
  optionalLineField,
  optionalTextField,
  requiredTextField,
  toFieldErrors,
} from "./fields";

const schema = z.object({ password: newPasswordField });

function errorFor(password: unknown) {
  const result = schema.safeParse({ password });
  return result.success ? undefined : toFieldErrors(result.error).password;
}

describe("newPasswordField", () => {
  it.each([
    ["", "passwordRequired"],
    [undefined, "passwordRequired"],
    ["a".repeat(11), "passwordTooShort"],
    ["a".repeat(73), "passwordTooLong"],
  ])("rejects %j", (password, key) => {
    expect(errorFor(password)).toBe(key);
  });

  it.each([12, 72])("accepts %i characters", (length) => {
    expect(errorFor("a".repeat(length))).toBeUndefined();
  });

  it("applies no character-class rules", () => {
    expect(errorFor("todo en minuscula sin numeros")).toBeUndefined();
  });
});

describe("requiredTextField", () => {
  const nameSchema = z.object({ name: requiredTextField("nameRequired") });

  it.each([[""], ["   "], [undefined], ["\n\t"]])("rejects %j with the given key", (name) => {
    const result = nameSchema.safeParse({ name });
    expect(result.success ? undefined : toFieldErrors(result.error).name).toBe("nameRequired");
  });

  it("trims and collapses inner whitespace", () => {
    expect(nameSchema.parse({ name: "  Cambio   de\taceite " }).name).toBe("Cambio de aceite");
  });
});

function parse(field: z.ZodType, value: unknown) {
  const result = z.object({ value: field }).safeParse({ value });
  return result.success
    ? { value: (result.data as { value: unknown }).value }
    : { error: toFieldErrors<"value">(result.error).value };
}

describe("idSchema", () => {
  it("accepts a uuid only", () => {
    expect(idSchema.safeParse("6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b").success).toBe(true);
    for (const value of ["nope", "", undefined, 5]) expect(idSchema.safeParse(value).success).toBe(false);
  });
});

describe("dniField", () => {
  it.each([[""], ["  "], [undefined], [null], ["..."]])("turns %j into null", (dni) => {
    expect(parse(dniField, dni)).toEqual({ value: null });
  });

  it("ignores dots and spaces", () => {
    expect(parse(dniField, "28.456.123")).toEqual({ value: "28456123" });
    expect(parse(dniField, " 28 456 123 ")).toEqual({ value: "28456123" });
  });

  it.each([["28a456"], ["28-456-123"], ["12,5"], ["284561239"], ["28.456.123.9"]])("rejects %j", (dni) => {
    expect(parse(dniField, dni)).toEqual({ error: "dniInvalid" });
  });
});

describe("optionalEmailField", () => {
  it.each([[""], ["   "], [undefined], [null]])("turns %j into null", (email) => {
    expect(parse(optionalEmailField, email)).toEqual({ value: null });
  });

  it("trims a valid email and keeps its case", () => {
    expect(parse(optionalEmailField, "  Ana@Example.com ")).toEqual({ value: "Ana@Example.com" });
  });

  it.each([["ana"], ["ana@"], ["ana@example"], ["a b@example.com"], [`${"a".repeat(250)}@example.com`]])(
    "rejects %j",
    (email) => {
      expect(parse(optionalEmailField, email)).toEqual({ error: "emailInvalid" });
    },
  );
});

describe("optionalLineField", () => {
  it.each([[""], ["  \t "], [undefined], [null]])("turns %j into null", (surname) => {
    expect(parse(optionalLineField, surname)).toEqual({ value: null });
  });

  it("trims and collapses inner whitespace, line breaks included", () => {
    expect(parse(optionalLineField, "  de   la\nCruz ")).toEqual({ value: "de la Cruz" });
  });
});

describe("optionalTextField", () => {
  const notesSchema = z.object({ notes: optionalTextField });

  it.each([[""], ["   "], [undefined], [null]])("turns %j into null", (notes) => {
    expect(notesSchema.parse({ notes }).notes).toBeNull();
  });

  it("trims but keeps line breaks", () => {
    expect(notesSchema.parse({ notes: "  Incluye filtro.\nNo incluye aceite.  " }).notes).toBe(
      "Incluye filtro.\nNo incluye aceite.",
    );
  });
});
