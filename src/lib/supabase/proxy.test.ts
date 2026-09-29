// @vitest-environment node
import { randomBytes } from "node:crypto";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionStore } from "@/lib/auth/session-store";
import { importAesKey } from "@/lib/crypto/aes-gcm";

const SECRET = randomBytes(32).toString("base64");

const auth = vi.hoisted(() => ({ getClaims: vi.fn(), signOut: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth }),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    SUPABASE_URL: "https://proyecto-ejemplo.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_ejemplo_0123456789",
    SESSION_COOKIE_SECRET: SECRET,
  }),
}));

import { updateSession } from "./proxy";

const SIGNED_IN = { data: { claims: { sub: "user-1", shop_id: "shop-1" } } };
const SIGNED_OUT = { data: null };

async function sessionCookieHeader(lastSeenAt: number) {
  const store = await createSessionStore({
    cookies: [],
    key: await importAesKey(SECRET),
    secure: true,
  });
  store.supabaseCookies.setAll?.([{ name: "torque-auth", value: "tokens", options: {} }], {});
  store.touch(lastSeenAt);
  const writes = await store.commit();
  return writes.map(({ name, value }) => `${name}=${value}`).join("; ");
}

function request(path: string, cookie?: string) {
  return new NextRequest(new URL(path, "https://torque.example"), {
    headers: cookie ? { cookie } : {},
  });
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signOut.mockResolvedValue({ error: null });
  });

  it("redirects signed-out visitors to the login page with next", async () => {
    auth.getClaims.mockResolvedValue(SIGNED_OUT);
    const response = await updateSession(request("/vehiculos/7"));
    expect(response.headers.get("location")).toBe(
      "https://torque.example/ingresar?next=%2Fvehiculos%2F7",
    );
  });

  it("lets signed-out visitors open the login page", async () => {
    auth.getClaims.mockResolvedValue(SIGNED_OUT);
    const response = await updateSession(request("/ingresar"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets an active session through and refreshes a stale activity stamp", async () => {
    auth.getClaims.mockResolvedValue(SIGNED_IN);
    const cookie = await sessionCookieHeader(Date.now() - 60 * 60 * 1000);
    const response = await updateSession(request("/turnos", cookie));
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("torque-session.0")?.value).toBeTruthy();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("signs out an idle session, revoking it in Supabase, and explains why", async () => {
    auth.getClaims.mockResolvedValue(SIGNED_IN);
    const cookie = await sessionCookieHeader(Date.now() - 25 * 60 * 60 * 1000);
    const response = await updateSession(request("/turnos", cookie));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe(
      "https://torque.example/ingresar?motivo=inactividad",
    );
    const cleared = response.cookies.get("torque-session.0");
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
  });

  it("sends signed-in users away from the login page", async () => {
    auth.getClaims.mockResolvedValue(SIGNED_IN);
    const cookie = await sessionCookieHeader(Date.now());
    const response = await updateSession(request("/ingresar", cookie));
    expect(response.headers.get("location")).toBe("https://torque.example/");
  });
});
