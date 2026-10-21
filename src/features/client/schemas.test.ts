import { describe, expect, it } from "vitest";

import { toFieldErrors } from "@/lib/validation/fields";

import { CLIENT_COLUMNS, clientFormSchema, clientRowSchema } from "./schemas";

const VALID = { name: "Ana", surname: "", phoneNumber: "11 1234-5678", dni: "", email: "" };

function errors(input: unknown) {
  const result = clientFormSchema.safeParse(input);
  return result.success ? undefined : toFieldErrors(result.error);
}

describe("clientFormSchema", () => {
  it("accepts only the required fields and nulls the rest", () => {
    expect(clientFormSchema.parse(VALID)).toEqual({
      name: "Ana",
      surname: null,
      phoneNumber: "11 1234-5678",
      dni: null,
      email: null,
    });
  });

  it("tidies every field", () => {
    expect(
      clientFormSchema.parse({
        name: "  Ana   María ",
        surname: " de  la   Cruz ",
        phoneNumber: " 11 1234-5678 ",
        dni: "28.456.123",
        email: " ana@example.com ",
      }),
    ).toEqual({
      name: "Ana María",
      surname: "de la Cruz",
      phoneNumber: "11 1234-5678",
      dni: "28456123",
      email: "ana@example.com",
    });
  });

  it("requires a name and a phone, each with its own message", () => {
    expect(errors({ ...VALID, name: "  ", phoneNumber: " - " })).toEqual({
      name: "nameRequired",
      phoneNumber: "phoneRequired",
    });
    expect(errors({ ...VALID, phoneNumber: "11 123" })).toEqual({ phoneNumber: "phoneInvalid" });
    expect(errors({ name: undefined, phoneNumber: undefined })).toEqual({
      name: "nameRequired",
      phoneNumber: "phoneRequired",
    });
  });

  it("rejects a DNI that isn't digits and an email with a bad format", () => {
    expect(errors({ ...VALID, dni: "28a456", email: "ana@" })).toEqual({ dni: "dniInvalid", email: "emailInvalid" });
  });

  it("puts no limit on lengths", () => {
    expect(errors({ ...VALID, name: "a".repeat(500), surname: "b".repeat(500) })).toBeUndefined();
  });
});

describe("clientRowSchema", () => {
  const row = {
    id: "c1",
    name: "Ana",
    surname: null,
    dni: "28456123",
    phone_number: "11 12345678",
    email: null,
    enabled: false,
    created_at: "2026-10-13T15:00:00+00:00",
  };

  it("maps a view row to the client the app uses", () => {
    expect(clientRowSchema.parse(row)).toEqual({
      id: "c1",
      name: "Ana",
      surname: null,
      dni: "28456123",
      phoneNumber: "11 12345678",
      email: null,
      enabled: false,
      createdAt: "2026-10-13T15:00:00+00:00",
    });
  });

  it("rejects a row without a phone", () => {
    expect(() => clientRowSchema.parse({ ...row, phone_number: null })).toThrow();
  });

  it("selects exactly the columns the schema reads", () => {
    expect(CLIENT_COLUMNS.split(", ").sort()).toEqual(Object.keys(row).sort());
  });
});
