import { describe, expect, it } from "vitest";
import { z } from "zod";

import { newPasswordField, toFieldErrors } from "./fields";

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
