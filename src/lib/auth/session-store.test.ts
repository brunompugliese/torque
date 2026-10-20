// @vitest-environment node
import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { importAesKey } from "@/lib/crypto/aes-gcm";

import {
  createSessionStore,
  MAX_CHUNK_LENGTH,
  SESSION_COOKIE_NAME,
  splitIntoChunks,
  type CookieWrite,
  type PhysicalCookie,
} from "./session-store";

const TOKENS = JSON.stringify({
  access_token: "eyJhbGciOiJFUzI1NiJ9.access.signature",
  refresh_token: "refresh-abc123",
  user: { id: "user-1", email: "persona@taller.com" },
});

async function newKey() {
  return importAesKey(randomBytes(32).toString("base64"));
}

function toCookies(writes: CookieWrite[]): PhysicalCookie[] {
  return writes.filter((w) => w.options.maxAge > 0).map(({ name, value }) => ({ name, value }));
}

async function storeWithSession(key: CryptoKey, value = TOKENS, lastSeenAt = 1_000) {
  const store = await createSessionStore({ cookies: [], key, secure: true });
  store.supabaseCookies.setAll?.([{ name: "torque-auth", value, options: {} }], {});
  store.touch(lastSeenAt);
  return toCookies(await store.commit());
}

describe("createSessionStore", () => {
  it("starts empty without cookies", async () => {
    const store = await createSessionStore({ cookies: [], key: await newKey(), secure: true });
    expect(await store.supabaseCookies.getAll()).toEqual([]);
    expect(store.lastSeenAt).toBeNull();
    expect(await store.commit()).toEqual([]);
  });

  it("round-trips Supabase cookies and the activity stamp", async () => {
    const key = await newKey();
    const cookies = await storeWithSession(key);

    const reloaded = await createSessionStore({ cookies, key, secure: true });
    expect(await reloaded.supabaseCookies.getAll()).toEqual([{ name: "torque-auth", value: TOKENS }]);
    expect(reloaded.lastSeenAt).toBe(1_000);
  });

  it("stores only ciphertext under the torque-session name", async () => {
    const cookies = await storeWithSession(await newKey());
    for (const { name, value } of cookies) {
      expect(name).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}\\.\\d+$`));
      for (const secret of ["refresh-abc123", "persona@taller.com", "user-1", "access"]) {
        expect(value).not.toContain(secret);
      }
    }
  });

  it("writes HttpOnly, SameSite=Lax, 24-hour cookies", async () => {
    const store = await createSessionStore({ cookies: [], key: await newKey(), secure: true });
    store.supabaseCookies.setAll?.([{ name: "torque-auth", value: TOKENS, options: {} }], {});
    const [write] = await store.commit();
    expect(write.options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
  });

  it("splits large sessions into chunks under the browser limit and reassembles them", async () => {
    const key = await newKey();
    const big = "x".repeat(9_000);
    const cookies = await storeWithSession(key, big);
    expect(cookies.length).toBeGreaterThan(1);
    for (const cookie of cookies) {
      expect(cookie.value.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH);
      expect(cookie.name.length + cookie.value.length).toBeLessThan(4000);
    }
    const reloaded = await createSessionStore({ cookies, key, secure: true });
    expect(await reloaded.supabaseCookies.getAll()).toEqual([{ name: "torque-auth", value: big }]);
  });

  it("deletes leftover chunks when the session shrinks", async () => {
    const key = await newKey();
    const cookies = await storeWithSession(key, "x".repeat(9_000));
    const store = await createSessionStore({ cookies, key, secure: true });
    store.supabaseCookies.setAll?.([{ name: "torque-auth", value: "small", options: {} }], {});
    const writes = await store.commit();
    const deleted = writes.filter((w) => w.options.maxAge === 0).map((w) => w.name);
    expect(deleted.length).toBe(cookies.length - 1);
  });

  it("treats a wrong key, tampering and missing chunks as no session", async () => {
    const key = await newKey();
    const cookies = await storeWithSession(key, "x".repeat(9_000));

    const wrongKey = await createSessionStore({ cookies, key: await newKey(), secure: true });
    expect(await wrongKey.supabaseCookies.getAll()).toEqual([]);

    const tampered = cookies.map((c, i) => (i === 0 ? { ...c, value: `A${c.value.slice(1)}` } : c));
    expect((await createSessionStore({ cookies: tampered, key, secure: true })).lastSeenAt).toBeNull();

    const missing = cookies.filter((c) => !c.name.endsWith(".0"));
    expect((await createSessionStore({ cookies: missing, key, secure: true })).lastSeenAt).toBeNull();
  });

  it("clear() deletes every chunk", async () => {
    const key = await newKey();
    const cookies = await storeWithSession(key);
    const store = await createSessionStore({ cookies, key, secure: true });
    store.clear();
    const writes = await store.commit();
    expect(writes.length).toBe(cookies.length);
    expect(writes.every((w) => w.value === "" && w.options.maxAge === 0)).toBe(true);
  });

  it("removes Supabase cookies set to empty or maxAge 0", async () => {
    const key = await newKey();
    const cookies = await storeWithSession(key);
    const store = await createSessionStore({ cookies, key, secure: true });
    store.supabaseCookies.setAll?.([{ name: "torque-auth", value: "", options: { maxAge: 0 } }], {});
    expect(await store.supabaseCookies.getAll()).toEqual([]);
  });

  it("passes through the no-store headers @supabase/ssr asks for", async () => {
    const store = await createSessionStore({ cookies: [], key: await newKey(), secure: true });
    store.supabaseCookies.setAll?.([{ name: "torque-auth", value: "v", options: {} }], {
      "Cache-Control": "private, no-store",
    });
    expect(store.responseHeaders).toEqual({ "Cache-Control": "private, no-store" });
  });
});

describe("splitIntoChunks", () => {
  it("splits and preserves content", () => {
    expect(splitIntoChunks("abcdefg", 3)).toEqual(["abc", "def", "g"]);
    expect(splitIntoChunks("", 3)).toEqual([]);
  });
});
