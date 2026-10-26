import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

const mocks = vi.hoisted(() => ({
  getAppointmentCountInRange: vi.fn(),
  getOpenJobCount: vi.fn(),
}));

vi.mock("@/features/appointment/queries", () => ({ getAppointmentCountInRange: mocks.getAppointmentCountInRange }));
vi.mock("@/features/job/queries", () => ({ getOpenJobCount: mocks.getOpenJobCount }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../../../../messages/es.json")).default;
  return {
    getTranslations: async (namespace: "home") => createTranslator({ locale: "es", messages, namespace }),
  };
});

import { HomeSummary } from "./home-summary";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T15:00:00Z"));
  mocks.getAppointmentCountInRange.mockReset();
  mocks.getOpenJobCount.mockReset();
});

async function renderSummary() {
  renderWithIntl((await HomeSummary()) ?? <></>);
}

describe("HomeSummary", () => {
  it("counts the appointments of today and the next six days, and the open jobs", async () => {
    mocks.getAppointmentCountInRange.mockResolvedValue({ ok: true, total: 3 });
    mocks.getOpenJobCount.mockResolvedValue({ ok: true, total: 12 });
    await renderSummary();
    expect(screen.getByText("3 turnos en los próximos 7 días, 12 trabajos abiertos.")).toBeInTheDocument();
    expect(mocks.getAppointmentCountInRange).toHaveBeenCalledWith("2026-10-25", "2026-10-31");
  });

  it("agrees singular and plural, and always says zero", async () => {
    mocks.getAppointmentCountInRange.mockResolvedValue({ ok: true, total: 1 });
    mocks.getOpenJobCount.mockResolvedValue({ ok: true, total: 0 });
    await renderSummary();
    expect(screen.getByText("1 turno en los próximos 7 días, 0 trabajos abiertos.")).toBeInTheDocument();
  });

  it("says one open job in the singular", async () => {
    mocks.getAppointmentCountInRange.mockResolvedValue({ ok: true, total: 0 });
    mocks.getOpenJobCount.mockResolvedValue({ ok: true, total: 1 });
    await renderSummary();
    expect(screen.getByText("0 turnos en los próximos 7 días, 1 trabajo abierto.")).toBeInTheDocument();
  });

  it("shows nothing when a count fails", async () => {
    mocks.getAppointmentCountInRange.mockResolvedValue({ ok: false });
    mocks.getOpenJobCount.mockResolvedValue({ ok: true, total: 2 });
    expect(await HomeSummary()).toBeNull();
  });
});
