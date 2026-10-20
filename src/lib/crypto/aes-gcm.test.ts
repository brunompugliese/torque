// @vitest-environment node
import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decrypt, encrypt, importAesKey } from "./aes-gcm";

const secret = () => randomBytes(32).toString("base64");

describe("aes-gcm", () => {
  it("round-trips text", async () => {
    const key = await importAesKey(secret());
    const token = await encrypt(key, "hola, mundo ñ");
    expect(await decrypt(key, token)).toBe("hola, mundo ñ");
  });

  it("never contains the plaintext and uses a fresh IV each time", async () => {
    const key = await importAesKey(secret());
    const a = await encrypt(key, "refresh-token-value");
    const b = await encrypt(key, "refresh-token-value");
    expect(a).not.toContain("refresh-token-value");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a different key", async () => {
    const token = await encrypt(await importAesKey(secret()), "data");
    expect(await decrypt(await importAesKey(secret()), token)).toBeNull();
  });

  it("rejects tampered data", async () => {
    const key = await importAesKey(secret());
    const token = await encrypt(key, "data");
    const flipped = token.slice(0, -2) + (token.at(-2) === "A" ? "B" : "A") + token.at(-1);
    expect(await decrypt(key, flipped)).toBeNull();
  });

  it("rejects garbage", async () => {
    const key = await importAesKey(secret());
    expect(await decrypt(key, "")).toBeNull();
    expect(await decrypt(key, "not-a-token")).toBeNull();
    expect(await decrypt(key, "%%%")).toBeNull();
  });
});
