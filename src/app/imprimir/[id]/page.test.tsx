import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JobSheet } from "@/features/job/sheet";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(async () => ({ userId: "u1", shopId: "shop-a" })),
  getJobSheet: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/features/job/queries", () => ({ getJobSheet: mocks.getJobSheet }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../sheet.css", () => ({}));
// The real Spanish messages, outside a Server Component.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: messages } = await import("../../../../messages/es.json");
  return {
    getTranslations: async (namespace: "jobs.print") => createTranslator({ locale: "es", messages, namespace }),
  };
});

import PrintJobPage, { generateMetadata } from "./page";

const ID = "00000000-0000-4000-8000-000000000001";
const SHEET = { number: "N° 000123" } as JobSheet;

function props(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof PrintJobPage>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("print page", () => {
  it("is not found for an id that isn't a uuid, without reading anything", async () => {
    await expect(PrintJobPage(props("not-a-uuid"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getJobSheet).not.toHaveBeenCalled();
  });

  it("checks the session before reading the job", async () => {
    mocks.getJobSheet.mockResolvedValue({ ok: true, sheet: SHEET });
    await PrintJobPage(props(ID));
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(mocks.getJobSheet).toHaveBeenCalledWith(ID);
  });

  it("is not found when the job isn't visible to the user (another shop's job included)", async () => {
    mocks.getJobSheet.mockResolvedValue({ ok: false, reason: "notFound" });
    await expect(PrintJobPage(props(ID))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("fails loudly when the data can't be read, instead of pretending the job doesn't exist", async () => {
    mocks.getJobSheet.mockResolvedValue({ ok: false, reason: "error" });
    await expect(PrintJobPage(props(ID))).rejects.toThrow("job sheet failed");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("titles the page with the job's number, for the saved PDF's name", async () => {
    mocks.getJobSheet.mockResolvedValue({ ok: true, sheet: SHEET });
    const metadata = await generateMetadata(props(ID));
    expect(metadata.title).toBe("Trabajo N° 000123");
  });
});
