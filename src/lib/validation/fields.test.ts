import { describe, expect, it } from "vitest";
import { z } from "zod";

import { newPasswordField, optionalTextField, requiredTextField, toFieldErrors } from "./fields";

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
