import { describe, expect, it } from "vitest";

import { toFieldErrors } from "@/lib/validation/fields";

import { loginSchema } from "./schemas";

function errorsFor(input: unknown) {
  const result = loginSchema.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
}

describe("loginSchema", () => {
  it("accepts valid input and normalizes the email", () => {
    const result = loginSchema.parse({ email: "  Persona@Taller.COM ", password: "clave" });
    expect(result).toEqual({ email: "persona@taller.com", password: "clave" });
  });

  it.each([
    ["", "emailRequired"],
    ["   ", "emailRequired"],
    ["persona", "emailInvalid"],
    ["persona@", "emailInvalid"],
    ["@taller.com", "emailInvalid"],
    [`${"a".repeat(250)}@x.com`, "emailInvalid"],
  ])("rejects email %j with %s", (email, key) => {
    expect(errorsFor({ email, password: "clave" }).email).toBe(key);
  });

  it("rejects a missing email", () => {
    expect(errorsFor({ password: "clave" }).email).toBe("emailRequired");
  });

  it("requires a password", () => {
    expect(errorsFor({ email: "a@b.com", password: "" }).password).toBe("passwordRequired");
    expect(errorsFor({ email: "a@b.com" }).password).toBe("passwordRequired");
  });

  it.each([1, 11, 200])("accepts an existing %i-character password as typed", (length) => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "a".repeat(length) }).success).toBe(
      true,
    );
  });

  it("keeps spaces in the password", () => {
    const password = "   con espacios   ";
    expect(loginSchema.parse({ email: "a@b.com", password }).password).toBe(password);
  });
});
