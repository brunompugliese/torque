import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ListSearchProvider } from "@/components/shared/list-search-provider";
import { renderWithIntl } from "@/test/render";

import type { JobPage } from "../queries";
import type { JobListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  nav: { search: "", replace: vi.fn() },
  searchJobs: vi.fn(),
  searchHomeJobs: vi.fn(),
  getStatusCounts: vi.fn(),
  getHomeStatusCounts: vi.fn(),
}));
vi.spyOn(window.history, "replaceState").mockImplementation((...args) => mocks.nav.replace(...args));

vi.mock("next/navigation", () => ({
  usePathname: () => "/inicio",
  useSearchParams: () => new URLSearchParams(mocks.nav.search),
}));
vi.mock("../actions", () => ({
  searchJobs: mocks.searchJobs,
  searchHomeJobs: mocks.searchHomeJobs,
  getStatusCounts: mocks.getStatusCounts,
  getHomeStatusCounts: mocks.getHomeStatusCounts,
  getJobDetails: vi.fn(async () => ({ ok: true, items: [], history: [] })),
  setJobArchived: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { JobsListView } from "./jobs-list";
import { JobsPanel } from "./jobs-panel";

// The modal is its own chunk: load it first so the first click doesn't wait for it.
beforeAll(async () => {
  await import("./job-modal");
});

const JOB: JobListItem = {
  id: "j1",
  number: 123,
  status: "en_progreso",
  observations: null,
  kilometers: 112500,
  quotedTotal: 605000,
  finalTotal: null,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: "v1", plate: "AB123CD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: "c1", name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: null,
};

const COUNTS = {
  pendiente: 4,
  presupuesto_enviado: 1,
  presupuesto_aceptado: 0,
  en_progreso: 6,
  completado: 2,
  entregado: 5,
  cancelado: 1,
};

function renderHome(initial: JobPage = { ok: true, rows: [JOB], matching: 1 }, total = 1) {
  return renderWithIntl(
    <ListSearchProvider>
      <JobsPanel>
        <JobsListView initial={initial} initialKey="" total={total} scope="home" />
      </JobsPanel>
    </ListSearchProvider>,
  );
}

function filterButton(name: string) {
  const button = screen
    .getAllByRole("button", { name: new RegExp(`^${name}`) })
    .find((candidate) => candidate.getAttribute("data-slot") === "popover-trigger");
  if (!button) throw new Error(`No filter button ${name}`);
  return button;
}

beforeEach(() => {
  mocks.nav.search = "";
  mocks.nav.replace.mockReset();
  for (const mock of [mocks.searchJobs, mocks.searchHomeJobs, mocks.getStatusCounts, mocks.getHomeStatusCounts]) {
    mock.mockReset();
  }
  mocks.searchHomeJobs.mockResolvedValue({ ok: true, rows: [JOB], matching: 1 });
  mocks.getHomeStatusCounts.mockResolvedValue({ ok: true, counts: COUNTS });
});

describe("JobsListView on Inicio", () => {
  it("has the search and the Estado filter, but no Fecha filter and no archived switch", () => {
    renderHome();
    expect(screen.getByPlaceholderText("Buscar por número, patente, marca, modelo o cliente")).toBeInTheDocument();
    expect(filterButton("Estado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Fecha/ })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Mostrar archivados" })).toBeNull();
    expect(screen.getByText("Fiat Cronos")).toBeInTheDocument();
  });

  it("searches through the home action, never the Trabajos one", async () => {
    renderHome();
    fireEvent.change(screen.getByPlaceholderText("Buscar por número, patente, marca, modelo o cliente"), {
      target: { value: "gol" },
    });
    await waitFor(() => expect(mocks.searchHomeJobs).toHaveBeenCalledWith("buscar=gol"));
    expect(mocks.searchJobs).not.toHaveBeenCalled();
  });

  it("lists all seven statuses with the window on the two closed ones, and the home counts", async () => {
    renderHome();
    fireEvent.click(filterButton("Estado"));
    await screen.findByRole("checkbox", { name: /^Pendiente/ });

    const boxes = await screen.findAllByRole("checkbox");
    // The visible text carries the short window; a screen reader hears the long one.
    expect(boxes.map((box) => box.closest("label")?.textContent)).toEqual([
      "Pendiente4",
      "Presupuesto enviado1",
      "Presupuesto aceptado0",
      "En progreso6",
      "Completado2",
      "Entregado (últ. 30 días)Entregado, últimos 30 días5",
      "Cancelado (últ. 30 días)Cancelado, últimos 30 días1",
    ]);
    expect(screen.getByRole("checkbox", { name: /^Entregado, últimos 30 días/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Cancelado, últimos 30 días/ })).toBeInTheDocument();
    expect(mocks.getHomeStatusCounts).toHaveBeenCalledOnce();
    expect(mocks.getStatusCounts).not.toHaveBeenCalled();
  });

  it("applies a ticked closed status to the URL", async () => {
    renderHome();
    fireEvent.click(filterButton("Estado"));
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Entregado, últimos 30 días/ }));
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/inicio?estado=entregado");
  });

  it("shows a ticked closed status as a chip with the window, and removes it", () => {
    mocks.nav.search = "estado=pendiente,cancelado";
    renderHome();
    expect(screen.getByText("Cancelado (últ. 30 días)")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro: Cancelado, últimos 30 días" }));
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/inicio?estado=pendiente");
  });

  it("drops a typed-in date from the URL, since Inicio has no dates", async () => {
    mocks.nav.search = "estado=pendiente&desde=2026-09-01&hasta=2026-09-30";
    renderHome();
    await waitFor(() => expect(mocks.nav.replace).toHaveBeenCalledWith(null, "", "/inicio?estado=pendiente"));
    expect(screen.queryByText(/Actualizado:/)).toBeNull();
  });

  it("says there are no open jobs, with a way to create one, when nothing is open and nothing is searched", () => {
    renderHome({ ok: true, rows: [], matching: 0 }, 0);
    expect(screen.getByText("No hay trabajos abiertos")).toBeInTheDocument();
    expect(screen.getByText("Los trabajos pendientes o en curso aparecen acá.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nuevo trabajo" })).toHaveLength(2);
  });

  it("offers to clear the search and the status when nothing matches", async () => {
    mocks.nav.search = "estado=entregado";
    mocks.searchHomeJobs.mockResolvedValue({ ok: true, rows: [], matching: 0 });
    renderHome({ ok: true, rows: [], matching: 0 }, 4);
    expect(await screen.findByText("No encontramos trabajos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar búsqueda y filtros" })).toBeInTheDocument();
  });

  it("opens a job with its actions (not read only)", async () => {
    renderHome();
    fireEvent.click(screen.getByText("Fiat Cronos"));
    expect(await screen.findByRole("button", { name: "Editar trabajo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archivar" })).toBeInTheDocument();
  });
});
