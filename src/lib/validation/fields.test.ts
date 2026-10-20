import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  dniField,
  newPasswordField,
  optionalEmailField,
  optionalLineField,
  optionalTextField,
  phoneField,
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

describe("phoneField", () => {
  it.each([[""], ["   "], ["---"], [undefined]])("rejects %j", (phone) => {
    expect(parse(phoneField, phone)).toEqual({ error: "phoneRequired" });
  });

  it("trims, removes hyphens and keeps everything else as entered", () => {
    expect(parse(phoneField, " 11 1234-5678 ")).toEqual({ value: "11 12345678" });
    expect(parse(phoneField, "(011) 4444 5555")).toEqual({ value: "(011) 4444 5555" });
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

  it.each([["28a456"], ["28-456-123"], ["12,5"]])("rejects %j", (dni) => {
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
