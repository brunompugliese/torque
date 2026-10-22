import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import type { VehicleJob } from "../schemas";

const mocks = vi.hoisted(() => ({ getVehicleJobs: vi.fn() }));

vi.mock("../actions", () => ({ getVehicleJobs: mocks.getVehicleJobs }));

import { VISIBLE_JOBS, VehicleJobs, VehicleJobsSkeleton } from "./vehicle-jobs";

function job(overrides: Partial<VehicleJob> = {}): VehicleJob {
  return {
    id: "j1",
    status: "en_progreso",
    kilometers: 112500,
    quotedTotal: 605000,
    finalTotal: null,
    enabled: true,
    createdAt: "2026-10-13T15:00:00+00:00",
    services: ["Cambio de aceite", "Alineación"],
    ...overrides,
  };
}

const manyJobs = (count: number) =>
  Array.from({ length: count }, (_, index) => job({ id: `j${index}`, kilometers: 1000 * (index + 1) }));

const load = (rows: VehicleJob[]) => mocks.getVehicleJobs.mockResolvedValue({ ok: true, rows });

async function renderJobs() {
  renderWithIntl(<VehicleJobs vehicleId="v1" />);
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
}

beforeEach(() => {
  mocks.getVehicleJobs.mockReset();
});

describe("VehicleJobs", () => {
  it("shows a busy skeleton announced once, then the history", async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.getVehicleJobs.mockReturnValue(new Promise((done) => (resolve = done)));
    const { container } = renderWithIntl(<VehicleJobs vehicleId="v1" />);

    expect(screen.getByRole("heading", { name: "Historial de trabajos" })).toBeInTheDocument();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);

    await act(async () => resolve({ ok: true, rows: [job()] }));
    expect(container.querySelector("[aria-busy='true']")).toBeNull();
    expect(screen.getByText("En progreso")).toBeInTheDocument();
  });

  it("loads the history of its vehicle", async () => {
    load([]);
    await renderJobs();
    expect(mocks.getVehicleJobs).toHaveBeenCalledWith("v1");
  });

  it("shows each visit: date, km, status, services and the total", async () => {
    load([job()]);
    await renderJobs();
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("13/10/2026")).toBeInTheDocument();
    expect(within(row).getByText("112.500 km")).toBeInTheDocument();
    expect(within(row).getByText("En progreso")).toBeInTheDocument();
    expect(within(row).getByText("Cambio de aceite, Alineación")).toHaveClass("truncate");
    expect(within(row).getByText("$ 605.000")).toBeInTheDocument();
  });

  it("labels the quoted total Presupuestado and the final total Final", async () => {
    load([
      job({ id: "j1", finalTotal: null, quotedTotal: 605000 }),
      job({ id: "j2", finalTotal: 650000, quotedTotal: 605000, status: "completado" }),
    ]);
    await renderJobs();
    const [quoted, final] = screen.getAllByRole("listitem");
    expect(within(quoted).getByText("Presupuestado")).toBeInTheDocument();
    expect(within(quoted).getByText("$ 605.000")).toBeInTheDocument();
    expect(within(final).getByText("Final")).toBeInTheDocument();
    expect(within(final).getByText("$ 650.000")).toBeInTheDocument();
  });

  it("shows — for a missing km, services or total", async () => {
    load([job({ kilometers: null, services: [], quotedTotal: null })]);
    await renderJobs();
    expect(within(screen.getByRole("listitem")).getAllByText("—")).toHaveLength(3);
  });

  it("greys out archived jobs and says so", async () => {
    load([job({ enabled: false })]);
    await renderJobs();
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Archivado")).toBeInTheDocument();
    expect(row.firstElementChild).toHaveClass("opacity-60");
  });

  it("keeps the rows as they come, newest first, and doesn't make them clickable", async () => {
    load([job({ id: "new", kilometers: 20000 }), job({ id: "old", kilometers: 10000 })]);
    await renderJobs();
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("20.000 km");
    expect(rows[1]).toHaveTextContent("10.000 km");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows five jobs and expands the rest in place with Ver todos (N)", async () => {
    load(manyJobs(8));
    await renderJobs();
    expect(VISIBLE_JOBS).toBe(5);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Ver todos (8)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByRole("button", { name: /Ver todos/ })).toBeNull();
    expect(mocks.getVehicleJobs).toHaveBeenCalledOnce();
  });

  it("has no Ver todos with five jobs or fewer", async () => {
    load(manyJobs(5));
    await renderJobs();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Ver todos/ })).toBeNull();
  });

  it("says when the vehicle has no jobs", async () => {
    load([]);
    await renderJobs();
    expect(screen.getByText("Este vehículo todavía no tiene trabajos.")).toBeInTheDocument();
  });

  it("offers Reintentar when loading fails, and loads again", async () => {
    mocks.getVehicleJobs.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, rows: [job()] });
    renderWithIntl(<VehicleJobs vehicleId="v1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("En progreso")).toBeInTheDocument();
    expect(mocks.getVehicleJobs).toHaveBeenCalledTimes(2);
  });

  it("shows the error too when the request itself fails", async () => {
    mocks.getVehicleJobs.mockRejectedValue(new Error("network"));
    renderWithIntl(<VehicleJobs vehicleId="v1" />);
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("VehicleJobsSkeleton", () => {
  it("is a busy region announced once, with placeholder rows", () => {
    const { container } = renderWithIntl(<VehicleJobsSkeleton rows={3} />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getAllByTestId("skeleton-block")).toHaveLength(9);
  });
});
