import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./env";

const VALID = {
  SUPABASE_URL: "https://proyecto-ejemplo.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ejemplo_0123456789",
  SESSION_COOKIE_SECRET: Buffer.alloc(32, 7).toString("base64"),
};

describe("parseServerEnv", () => {
  it("accepts valid variables", () => {
    expect(parseServerEnv(VALID)).toEqual(VALID);
  });

  it.each(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SESSION_COOKIE_SECRET"] as const)(
    "names a missing %s",
    (name) => {
      expect(() => parseServerEnv({ ...VALID, [name]: undefined })).toThrow(name);
    },
  );

  it("rejects a secret that isn't 32 bytes", () => {
    expect(() =>
      parseServerEnv({ ...VALID, SESSION_COOKIE_SECRET: Buffer.alloc(16).toString("base64") }),
    ).toThrow("SESSION_COOKIE_SECRET");
  });

  it("never includes values in the error", () => {
    const bad = { ...VALID, SUPABASE_URL: "not a url", SESSION_COOKIE_SECRET: "short-secret" };
    try {
      parseServerEnv(bad);
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain("not a url");
      expect(message).not.toContain("short-secret");
      expect(message).not.toContain(VALID.SUPABASE_ANON_KEY);
    }
  });
});
