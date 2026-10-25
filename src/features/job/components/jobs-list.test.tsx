import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListSearchProvider } from "@/components/shared/list-search-provider";
import { renderWithIntl } from "@/test/render";

import type { JobPage } from "../queries";
import type { JobListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  nav: { search: "", replace: vi.fn() },
  searchJobs: vi.fn(),
  getStatusCounts: vi.fn(),
}));
vi.spyOn(window.history, "replaceState").mockImplementation((...args) => mocks.nav.replace(...args));

vi.mock("next/navigation", () => ({
  usePathname: () => "/trabajos",
  useSearchParams: () => new URLSearchParams(mocks.nav.search),
}));
vi.mock("../actions", () => ({
  searchJobs: mocks.searchJobs,
  getStatusCounts: mocks.getStatusCounts,
  getJobDetails: vi.fn(async () => ({ ok: true, items: [], history: [] })),
  setJobArchived: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { JobsListView } from "./jobs-list";
import { JobsPanel } from "./jobs-panel";

const JOB: JobListItem = {
  id: "j1",
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
const OTHER: JobListItem = {
  ...JOB,
  id: "j2",
  vehicle: { ...JOB.vehicle, id: "v2", plate: "AE482KD", brandName: "Volkswagen", modelName: "Gol" },
};

const COUNTS = {
  pendiente: 4,
  presupuesto_enviado: 1,
  presupuesto_aceptado: 0,
  en_progreso: 6,
  completado: 2,
  entregado: 12,
  cancelado: 3,
};

function renderList(initial: JobPage = { ok: true, rows: [JOB], matching: 1 }, total = 1) {
  return renderWithIntl(
    <ListSearchProvider>
      <JobsPanel>
        <JobsListView initial={initial} initialKey="" total={total} />
      </JobsPanel>
    </ListSearchProvider>,
  );
}

// The toolbar's filter buttons; the table also has sort buttons with the same names.
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
  mocks.searchJobs.mockReset();
  mocks.searchJobs.mockResolvedValue({ ok: true, rows: [JOB], matching: 1 });
  mocks.getStatusCounts.mockReset();
  mocks.getStatusCounts.mockResolvedValue({ ok: true, counts: COUNTS });
});

describe("JobsListView", () => {
  it("shows the toolbar with the search, the two filters and the archived switch, and the first rows", () => {
    renderList();
    expect(screen.getByPlaceholderText("Buscar por patente, marca, modelo o cliente")).toBeInTheDocument();
    expect(filterButton("Estado")).toBeInTheDocument();
    expect(filterButton("Fecha")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Mostrar archivados" })).not.toBeChecked();
    expect(screen.getByText("Fiat Cronos")).toBeInTheDocument();
    expect(mocks.searchJobs).not.toHaveBeenCalled();
  });

  it("searches on the server with the text in the request body, never in the URL, showing placeholders meanwhile", async () => {
    let resolve!: (page: JobPage) => void;
    mocks.searchJobs.mockReturnValue(new Promise<JobPage>((done) => (resolve = done)));
    renderList();

    fireEvent.change(screen.getByPlaceholderText("Buscar por patente, marca, modelo o cliente"), {
      target: { value: "ae 482" },
    });
    await waitFor(() => expect(mocks.searchJobs).toHaveBeenCalledWith("buscar=ae+482"));
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos");
    expect(screen.queryByText("Fiat Cronos")).toBeNull();
    expect(screen.getAllByText("Cargando…")).toHaveLength(1);

    resolve({ ok: true, rows: [OTHER], matching: 1 });
    expect(await screen.findByText("Volkswagen Gol")).toBeInTheDocument();
  });

  it("sends the filters with the search", async () => {
    mocks.nav.search = "estado=entregado&desde=2026-09-01";
    mocks.searchJobs.mockResolvedValue({ ok: true, rows: [OTHER], matching: 1 });
    renderList();
    fireEvent.change(screen.getByPlaceholderText("Buscar por patente, marca, modelo o cliente"), {
      target: { value: "gol" },
    });
    await waitFor(() => expect(mocks.searchJobs).toHaveBeenCalledWith("buscar=gol&desde=2026-09-01&estado=entregado"));
  });

  it("offers to retry when the search fails", async () => {
    mocks.searchJobs.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ok: true, rows: [OTHER], matching: 1 });
    renderList();
    fireEvent.change(screen.getByPlaceholderText("Buscar por patente, marca, modelo o cliente"), {
      target: { value: "gol" },
    });
    // The search waits for its debounce, which takes longer on a busy machine.
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }, { timeout: 4000 }));
    expect(await screen.findByText("Volkswagen Gol", {}, { timeout: 4000 })).toBeInTheDocument();
  });
});

describe("Estado filter", () => {
  async function openStatus() {
    fireEvent.click(filterButton("Estado"));
    return screen.findByRole("checkbox", { name: /^Pendiente/ });
  }

  it("lists the seven statuses in order, each with its count, loaded when it opens", async () => {
    renderList();
    expect(mocks.getStatusCounts).not.toHaveBeenCalled();
    await openStatus();

    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes.map((box) => box.getAttribute("aria-label") ?? box.closest("label")?.textContent)).toEqual([
      "Pendiente4",
      "Presupuesto enviado1",
      "Presupuesto aceptado0",
      "En progreso6",
      "Completado2",
      "Entregado12",
      "Cancelado3",
    ]);
    expect(mocks.getStatusCounts).toHaveBeenCalledOnce();
  });

  it("counts for the current search, archived switch and dates, but not the status selection", async () => {
    mocks.nav.search = "estado=entregado&desde=2026-09-01&archivados=1&orden=km&pagina=2";
    renderList();
    await openStatus();
    expect(mocks.getStatusCounts).toHaveBeenCalledWith("archivados=1&desde=2026-09-01");
  });

  it("applies a choice to the URL, back to page 1", async () => {
    mocks.nav.search = "pagina=3";
    renderList();
    fireEvent.click(await openStatus());
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?estado=pendiente");
  });

  it("has a Limpiar that clears only the statuses, and only while one is chosen", async () => {
    mocks.nav.search = "estado=entregado&desde=2026-09-01&pagina=2";
    renderList();
    await openStatus();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtro: Estado" }));
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?desde=2026-09-01");
  });

  it("shows no Limpiar without a chosen status", async () => {
    renderList();
    await openStatus();
    expect(screen.queryByRole("button", { name: /Limpiar/ })).toBeNull();
  });

  it("keeps the selection in the status order when adding a choice", async () => {
    mocks.nav.search = "estado=entregado";
    renderList();
    await openStatus();
    fireEvent.click(screen.getByRole("checkbox", { name: /^En progreso/ }));
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?estado=en_progreso%2Centregado");
  });

  it("shows how many statuses are chosen on its button", () => {
    mocks.nav.search = "estado=entregado,cancelado";
    renderList();
    expect(filterButton("Estado")).toHaveTextContent("· 2");
  });

  it("shows placeholders for the counts while they load, then the numbers", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getStatusCounts.mockReturnValue(new Promise((done) => (resolve = done)));
    renderList();
    await openStatus();
    expect(screen.queryByText("12")).toBeNull();
    expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0);

    resolve({ ok: true, counts: COUNTS });
    expect(await screen.findByText("12")).toBeInTheDocument();
  });

  it("still works without the counts when they fail to load", async () => {
    mocks.getStatusCounts.mockResolvedValue({ ok: false });
    renderList();
    fireEvent.click(await openStatus());
    expect(await screen.findByText("No pudimos cargar las cantidades.")).toBeInTheDocument();
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?estado=pendiente");
  });
});

describe("filters in the URL that apply to nothing", () => {
  it("are dropped from the address bar, keeping the rest", async () => {
    mocks.nav.search = "hasta=0002-02-20&estado=entregado&pagina=2";
    renderList();
    await waitFor(() => expect(mocks.nav.replace).toHaveBeenCalled());
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?estado=entregado");
  });

  it("drop a range in the wrong order and an unknown status", async () => {
    mocks.nav.search = "desde=2026-09-30&hasta=2026-09-01&estado=nada";
    renderList();
    await waitFor(() => expect(mocks.nav.replace).toHaveBeenCalled());
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos");
  });

  it("leave a URL with valid filters alone", async () => {
    mocks.nav.search = "estado=entregado&desde=2026-09-01&hasta=2026-09-30";
    renderList();
    await screen.findByText("Fiat Cronos");
    expect(mocks.nav.replace).not.toHaveBeenCalled();
  });
});

describe("Fecha filter", () => {
  function openDate() {
    fireEvent.click(filterButton("Fecha"));
    return screen.findByLabelText("Desde");
  }

  it("does not write a year that is still being typed to the URL", async () => {
    renderList();
    fireEvent.change(await openDate(), { target: { value: "0002-02-20" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "0202-02-20" } });
    expect(mocks.nav.replace).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-02-20" } });
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?desde=2026-02-20");
  });

  it("applies each day to the URL", async () => {
    renderList();
    fireEvent.change(await openDate(), { target: { value: "2026-09-01" } });
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?desde=2026-09-01");
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-30" } });
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?desde=2026-09-01&hasta=2026-09-30");
  });

  it("has a Limpiar that clears both days, keeping the statuses, and only while a day is set", async () => {
    mocks.nav.search = "estado=entregado&desde=2026-09-01&hasta=2026-09-30";
    renderList();
    await openDate();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtro: Fecha" }));
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?estado=entregado");
  });

  it("shows no Limpiar without a day", async () => {
    renderList();
    await openDate();
    expect(screen.queryByRole("button", { name: /Limpiar/ })).toBeNull();
  });

  it("shows the applied days", async () => {
    mocks.nav.search = "desde=2026-09-01&hasta=2026-09-30";
    renderList();
    expect(await openDate()).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-09-30");
  });

  it("explains a Desde after Hasta and does not apply it", async () => {
    mocks.nav.search = "hasta=2026-09-10";
    renderList();
    fireEvent.change(await openDate(), { target: { value: "2026-09-20" } });
    expect(screen.getByRole("alert")).toHaveTextContent("La fecha “Desde” no puede ser posterior a “Hasta”.");
    expect(mocks.nav.replace).not.toHaveBeenCalled();
  });
});

describe("filter chips", () => {
  it("shows no chips without filters", () => {
    renderList();
    expect(screen.queryByRole("button", { name: /Quitar filtro/ })).toBeNull();
  });

  it("shows a chip per status and one for the dates", () => {
    mocks.nav.search = "estado=entregado,cancelado&desde=2026-09-01&hasta=2026-09-30";
    renderList();
    expect(screen.getByRole("button", { name: "Quitar filtro: Entregado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar filtro: Cancelado" })).toBeInTheDocument();
    expect(screen.getByText("Actualizado: 01/09/2026 al 30/09/2026")).toBeInTheDocument();
  });

  it.each([
    ["desde=2026-09-01", "Actualizado: desde 01/09/2026"],
    ["hasta=2026-09-30", "Actualizado: hasta 30/09/2026"],
  ])("words a single bound (%s)", (search, text) => {
    mocks.nav.search = search;
    renderList();
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("removes one status, keeping the others and the dates", () => {
    mocks.nav.search = "estado=entregado,cancelado&desde=2026-09-01";
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro: Entregado" }));
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?desde=2026-09-01&estado=cancelado");
  });

  it("removes the dates, keeping the statuses", () => {
    mocks.nav.search = "estado=entregado&desde=2026-09-01&hasta=2026-09-30";
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro: Actualizado: 01/09/2026 al 30/09/2026" }));
    expect(mocks.nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?estado=entregado");
  });

  it("drops a range the URL has in the wrong order instead of showing a chip", () => {
    mocks.nav.search = "desde=2026-09-30&hasta=2026-09-01";
    renderList();
    expect(screen.queryByText(/Actualizado:/)).toBeNull();
  });

  it("is keyboard operable: the remove button is a real button in the tab order", () => {
    mocks.nav.search = "estado=entregado";
    renderList();
    const chip = screen.getByRole("button", { name: "Quitar filtro: Entregado" });
    expect(chip.tagName).toBe("BUTTON");
    expect(within(chip.closest("li")!).getByText("Entregado")).toBeInTheDocument();
  });
});
