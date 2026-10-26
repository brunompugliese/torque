import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listJobs: vi.fn(async () => ({ ok: true, rows: [], matching: 0 })),
  getJobStatusCounts: vi.fn(async () => ({ ok: true, counts: {} })),
  getOpenJobCount: vi.fn(async () => ({ ok: true, total: 3 })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("./queries", () => ({
  listJobs: mocks.listJobs,
  getJobStatusCounts: mocks.getJobStatusCounts,
  getOpenJobCount: mocks.getOpenJobCount,
}));

import { getHomeOpenJobCount, getHomeStatusCounts, searchHomeJobs } from "./actions";

beforeEach(() => vi.clearAllMocks());

describe("Inicio's job actions", () => {
  it("searchHomeJobs runs the list in the home scope, whatever the request carries", async () => {
    await searchHomeJobs("buscar=ae&estado=entregado&scope=all&desde=2020-01-01");
    expect(mocks.listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ search: "ae", filters: expect.objectContaining({ estado: "entregado" }) }),
      "home",
    );
  });

  it("searchHomeJobs copes with a malformed request", async () => {
    await searchHomeJobs(42);
    expect(mocks.listJobs).toHaveBeenCalledWith(expect.objectContaining({ search: "" }), "home");
  });

  it("getHomeStatusCounts asks for the home counts", async () => {
    await getHomeStatusCounts("buscar=ae");
    expect(mocks.getJobStatusCounts).toHaveBeenCalledWith(expect.objectContaining({ search: "ae" }), "home");
  });

  it("getHomeOpenJobCount returns the open count", async () => {
    expect(await getHomeOpenJobCount()).toEqual({ ok: true, total: 3 });
  });
});
