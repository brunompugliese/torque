import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const auth = {
    signInWithPassword: vi.fn(),
    getClaims: vi.fn(),
    signOut: vi.fn(),
  };
  const store = { touch: vi.fn(), clear: vi.fn() };
  const persist = vi.fn();
  const redirect = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  return { auth, store, persist, redirect };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    supabase: { auth: mocks.auth },
    store: mocks.store,
    persist: mocks.persist,
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { signIn, signOut } from "./actions";

const EMAIL = "persona@taller.com";
const PASSWORD = "una-clave-larga";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const IDLE = { status: "idle" } as const;

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.signInWithPassword.mockResolvedValue({ error: null });
    mocks.auth.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", shop_id: "shop-1" } },
    });
    mocks.auth.signOut.mockResolvedValue({ error: null });
  });

  it("rejects invalid input without calling Supabase", async () => {
    const result = await signIn(IDLE, form({ email: "no-es-email", password: "" }));
    expect(result).toEqual({
      status: "error",
      fieldErrors: { email: "emailInvalid", password: "passwordRequired" },
    });
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("sends a short existing password to Supabase as typed", async () => {
    await expect(signIn(IDLE, form({ email: EMAIL, password: "corta" }))).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: "corta" });
  });

  it("signs in with the normalized email, stamps activity and redirects to a safe path", async () => {
    await expect(
      signIn(IDLE, form({ email: ` ${EMAIL.toUpperCase()} `, password: PASSWORD, next: "/turnos" })),
    ).rejects.toThrow("NEXT_REDIRECT:/turnos");
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(mocks.store.touch).toHaveBeenCalledTimes(1);
    expect(mocks.persist).toHaveBeenCalled();
  });

  it.each(["https://evil.example", "//evil.example", "/salir"])(
    "ignores an unsafe next (%s)",
    async (next) => {
      await expect(signIn(IDLE, form({ email: EMAIL, password: PASSWORD, next }))).rejects.toThrow(
        "NEXT_REDIRECT:/",
      );
    },
  );

  it.each([
    ["invalid_credentials", "invalidCredentials"],
    ["user_banned", "invalidCredentials"],
    ["email_not_confirmed", "invalidCredentials"],
    ["over_request_rate_limit", "rateLimited"],
  ])("maps %s to %s without echoing credentials", async (code, formError) => {
    mocks.auth.signInWithPassword.mockResolvedValue({ error: { code, status: 400 } });
    const result = await signIn(IDLE, form({ email: EMAIL, password: PASSWORD }));
    expect(result).toEqual({ status: "error", formError });
    expect(JSON.stringify(result)).not.toContain(EMAIL);
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("logs only the code and status of unexpected errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.auth.signInWithPassword.mockResolvedValue({
      error: { code: "unexpected_failure", status: 500, message: `boom ${EMAIL}` },
    });
    const result = await signIn(IDLE, form({ email: EMAIL, password: PASSWORD }));
    expect(result).toEqual({ status: "error", formError: "unexpected" });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("unexpected_failure");
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD);
    log.mockRestore();
  });

  it("signs out a user without a shop and reports the account as unavailable", async () => {
    mocks.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    const result = await signIn(IDLE, form({ email: EMAIL, password: PASSWORD }));
    expect(result).toEqual({ status: "error", formError: "accountUnavailable" });
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.store.clear).toHaveBeenCalled();
    expect(mocks.store.touch).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ends this device's session, clears cookies and goes to the login page", async () => {
    mocks.auth.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/ingresar");
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.store.clear).toHaveBeenCalled();
    expect(mocks.persist).toHaveBeenCalled();
  });
});
