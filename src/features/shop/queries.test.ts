import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabase, filterValue, type FakeQuery, type FakeResult } from "@/test/supabase";

const mocks = vi.hoisted(() => ({
  supabase: null as unknown,
  requireSession: vi.fn(async () => ({ userId: "u1", shopId: "shop-a" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ supabase: mocks.supabase }),
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));

import { getShop, getShopLogoPath } from "./queries";

const ROW = {
  name: "Taller Ejemplo",
  address: "Calle Falsa 123",
  phone: "11 5555-0101",
  logo_path: "shop-a/logo.png",
};

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

beforeEach(() => {
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getShop", () => {
  it("checks the session and reads the user's own shop", async () => {
    const queries = setup(() => ({ data: ROW }));
    await getShop();

    expect(mocks.requireSession).toHaveBeenCalled();
    expect(queries[0].table).toBe("shop");
    expect(queries[0].calls[0]).toEqual(["select", "name, address, phone, logo_path"]);
    expect(filterValue(queries[0], "eq", "id")).toBe("shop-a");
  });

  it("maps the row and never exposes the logo's path", async () => {
    setup(() => ({ data: ROW }));
    const shop = await getShop();

    expect(shop).toEqual({ name: "Taller Ejemplo", address: "Calle Falsa 123", phone: "11 5555-0101", hasLogo: true });
    expect(JSON.stringify(shop)).not.toContain("shop-a/logo.png");
  });

  it("treats missing and blank values as none", async () => {
    setup(() => ({ data: { ...ROW, address: "  ", phone: null, logo_path: "" } }));

    expect(await getShop()).toEqual({ name: "Taller Ejemplo", address: null, phone: null, hasLogo: false });
  });

  it("returns null and logs only the code when the query fails", async () => {
    setup(() => ({ error: { code: "42501", message: "secret detail" } }));

    expect(await getShop()).toBeNull();
    expect(console.error).toHaveBeenCalledWith("[shop] query failed", { code: "42501" });
  });

  it("returns null when there is no row or it is malformed", async () => {
    setup(() => ({ data: null }));
    expect(await getShop()).toBeNull();

    setup(() => ({ data: { name: 5 } }));
    expect(await getShop()).toBeNull();
  });
});

describe("getShopLogoPath", () => {
  it("reads the logo path of the user's shop", async () => {
    const queries = setup(() => ({ data: { logo_path: "shop-a/logo.png" } }));

    expect(await getShopLogoPath()).toBe("shop-a/logo.png");
    expect(queries[0].calls[0]).toEqual(["select", "logo_path"]);
    expect(filterValue(queries[0], "eq", "id")).toBe("shop-a");
  });

  it("returns null without a logo or when the query fails", async () => {
    setup(() => ({ data: { logo_path: null } }));
    expect(await getShopLogoPath()).toBeNull();

    setup(() => ({ error: { code: "XX000" } }));
    expect(await getShopLogoPath()).toBeNull();
    expect(console.error).toHaveBeenCalledWith("[shop] logo path query failed", { code: "XX000" });
  });
});
