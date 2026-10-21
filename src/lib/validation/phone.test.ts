import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toFieldErrors } from "./fields";
import { phoneField } from "./phone";

function parse(field: z.ZodType, value: unknown) {
  const result = z.object({ value: field }).safeParse({ value });
  return result.success
    ? { value: (result.data as { value: unknown }).value }
    : { error: toFieldErrors<"value">(result.error).value };
}

describe("phoneField", () => {
  it.each([[""], ["   "], ["---"], ["abc"], ["000"], [undefined]])("requires a phone for %j", (phone) => {
    expect(parse(phoneField, phone)).toEqual({ error: "phoneRequired" });
  });

  it.each([["1"], ["11 1234-567"], ["1112345678 9"], ["11 1234-56789"]])("rejects %j: not 10 digits", (phone) => {
    expect(parse(phoneField, phone)).toEqual({ error: "phoneInvalid" });
  });

  it("stores 10 digits formatted, whatever way they were typed", () => {
    expect(parse(phoneField, "1112345678")).toEqual({ value: "11 1234-5678" });
    expect(parse(phoneField, " 11 1234-5678 ")).toEqual({ value: "11 1234-5678" });
    expect(parse(phoneField, "(011) 4444 5555")).toEqual({ value: "11 4444-5555" });
    expect(parse(phoneField, "2211234567")).toEqual({ value: "221 123-4567" });
    expect(parse(phoneField, "2966123456")).toEqual({ value: "2966 12-3456" });
  });

  it("is idempotent: a stored phone passes again unchanged", () => {
    expect(parse(phoneField, "11 1234-5678")).toEqual({ value: "11 1234-5678" });
  });
});
