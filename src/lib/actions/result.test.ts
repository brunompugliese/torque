import { describe, expect, it } from "vitest";

import { fail, ok } from "./result";

describe("action results", () => {
  it("wraps data", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });

  it("wraps an error with or without field errors", () => {
    expect(fail("unexpected")).toEqual({ ok: false, error: "unexpected" });
    expect(fail("invalid", { name: "nameRequired" })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { name: "nameRequired" },
    });
  });
});
