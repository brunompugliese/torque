import { Blob } from "node:buffer"; // the server's Blob; jsdom's isn't a valid Response body
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(async () => ({ userId: "u1", shopId: "shop-a" })),
  getShopLogoPath: vi.fn<() => Promise<string | null>>(),
  download: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ supabase: { storage: { from: mocks.from } } }),
}));
vi.mock("@/features/shop/queries", () => ({
  getShopLogoPath: mocks.getShopLogoPath,
  SHOP_LOGOS_BUCKET: "shop-logos",
}));

import { GET } from "./route";

const PATH = "shop-a/secret-logo.png";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ download: mocks.download });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /logo", () => {
  it("checks the session first", async () => {
    mocks.getShopLogoPath.mockResolvedValue(null);
    await GET();

    expect(mocks.requireSession).toHaveBeenCalled();
  });

  it("is a 404 when the shop has no logo, without touching Storage", async () => {
    mocks.getShopLogoPath.mockResolvedValue(null);
    const response = await GET();

    expect(response.status).toBe(404);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("is a 404 when the download fails, logging nothing about the file", async () => {
    mocks.getShopLogoPath.mockResolvedValue(PATH);
    mocks.download.mockResolvedValue({ data: null, error: { message: `Object not found: ${PATH}` } });
    const response = await GET();

    expect(response.status).toBe(404);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(PATH);
  });

  it("is a 404 for a file that isn't an accepted image", async () => {
    mocks.getShopLogoPath.mockResolvedValue(PATH);
    mocks.download.mockResolvedValue({ data: new Blob(["<svg/>"], { type: "image/svg+xml" }), error: null });

    expect((await GET()).status).toBe(404);
  });

  it("serves the file from the logos bucket with its type and a private cache", async () => {
    mocks.getShopLogoPath.mockResolvedValue(PATH);
    mocks.download.mockResolvedValue({ data: new Blob(["png-bytes"], { type: "image/png" }), error: null });
    const response = await GET();

    expect(mocks.from).toHaveBeenCalledWith("shop-logos");
    expect(mocks.download).toHaveBeenCalledWith(PATH);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(await response.text()).toBe("png-bytes");
  });
});
