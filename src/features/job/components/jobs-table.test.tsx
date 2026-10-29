import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ListSearchProvider } from "@/components/shared/list-search-provider";
import { renderWithIntl } from "@/test/render";

import type { JobListItem } from "../schemas";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.spyOn(window.history, "replaceState").mockImplementation((...args) => nav.replace(...args));

vi.mock("next/navigation", () => ({
  usePathname: () => "/trabajos",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("../actions", () => ({
  searchJobs: vi.fn(),
  getStatusCounts: vi.fn(),
  getJobDetails: vi.fn(async () => ({ ok: true, items: [], history: [] })),
  setJobArchived: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { JobsPanel } from "./jobs-panel";
import { JobsTable, JobsTableSkeleton } from "./jobs-table";
import { NewJobButton } from "./new-job-button";

// The panel loads its modal lazily; loading it up front keeps the first
// "opens the modal" test from racing the import.
beforeAll(async () => {
  await import("./job-modal");
});

const ACTIVE: JobListItem = {
  id: "j1",
  number: 123,
  status: "en_progreso",
  observations: null,
  kilometers: 112500,
  quotedTotal: 605000,
  finalTotal: 650000.5,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: "v1", plate: "AB123CD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: "c1", name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: null,
};
const BARE: JobListItem = {
  ...ACTIVE,
  id: "j2",
  status: "pendiente",
  kilometers: null,
  quotedTotal: 12500.5,
  finalTotal: null,
  enabled: false,
  vehicle: { ...ACTIVE.vehicle, id: "v2", plate: "ABC123", year: null, brandName: "Volkswagen", modelName: "Gol" },
  client: null,
};
const NO_TOTAL: JobListItem = { ...BARE, id: "j3", quotedTotal: null };

function renderTable(props: Parameters<typeof JobsTable>[0]) {
  return renderWithIntl(
    <ListSearchProvider>
      <JobsPanel>
        <NewJobButton />
        <JobsTable {...props} />
      </JobsPanel>
    </ListSearchProvider>,
  );
}

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
});

describe("JobsTable", () => {
  it("lists the eight columns with no header marked as sorted", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const table = screen.getByRole("table", { name: "Trabajos" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "N°",
      "Patente",
      "Vehículo",
      "Cliente",
      "Estado",
      "Kilometraje",
      "Total",
      "Actualizado",
    ]);
    for (const header of headers) {
      expect(header).not.toHaveAttribute("aria-sort");
      expect(within(header).getByRole("button")).toBeInTheDocument();
    }
  });

  it("shows the number as N° 000123, without wrapping", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getByText("N° 000123")).toHaveClass("whitespace-nowrap", "tabular-nums");
  });

  it("sorts by number, ascending on the first click", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByRole("button", { name: /N°/ }));
    expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?orden=numero");
  });

  it("shows the plate drawn, the vehicle with its year below, client, status, km, total and date", () => {
    const { container } = renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const row = screen.getByText("Fiat Cronos").closest("tr")!;
    expect(container.querySelector('[data-slot="plate"]')).toHaveTextContent("AB 123 CD");
    const vehicleCell = screen.getByText("Fiat Cronos").closest("td")!;
    expect(within(vehicleCell).getByText("2021")).toHaveClass("text-muted-foreground");
    expect(within(row).getByText("Ana Gómez")).toHaveClass("truncate");
    expect(within(row).getByText("En progreso")).toBeInTheDocument();
    expect(within(row).getByText("112.500 km")).toHaveClass("tabular-nums");
    expect(within(row).getByText("$ 650.000,50")).toHaveClass("tabular-nums");
    expect(within(row).getByText("14/10/2026")).toHaveClass("text-muted-foreground");
    expect(within(row).queryByText("Archivado")).not.toBeInTheDocument();
  });

  it("labels the total Final when there is a final total, Presupuestado otherwise", () => {
    renderTable({ ok: true, rows: [ACTIVE, BARE], matching: 2, total: 2 });
    const final = screen.getByText("$ 650.000,50").closest("td")!;
    expect(within(final).getByText("Final")).toBeInTheDocument();
    const quoted = screen.getByText("$ 12.500,50").closest("td")!;
    expect(within(quoted).getByText("Presupuestado")).toBeInTheDocument();
  });

  it("aligns the plate to the center and the km and total to the right, headers included", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getByRole("columnheader", { name: /Patente/ })).toHaveClass("text-center");
    expect(screen.getByRole("columnheader", { name: /Kilometraje/ })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: /Total/ })).toHaveClass("text-right");
    expect(screen.getByText("112.500 km").closest("td")).toHaveClass("text-right");
    expect(screen.getByText("$ 650.000,50").closest("td")).toHaveClass("text-right");
  });

  it("keeps the Vehículo column readable on a narrow screen, header included", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getByRole("columnheader", { name: /Vehículo/ })).toHaveClass("min-w-44");
    expect(screen.getByText("Fiat Cronos").closest("td")).toHaveClass("min-w-44");
  });

  it("shows dashes for empty values, Sin cliente, and archived rows greyed with a badge", () => {
    renderTable({ ok: true, rows: [BARE, NO_TOTAL], matching: 2, total: 2 });
    const [row, noTotalRow] = screen.getAllByText("Volkswagen Gol").map((name) => name.closest("tr")!);
    expect(row).toHaveAttribute("data-muted", "true");
    expect(within(row).getByText("Archivado")).toBeInTheDocument();
    const cells = within(row).getAllByRole("cell");
    expect(cells[3]).toHaveTextContent("Sin cliente");
    expect(cells[5]).toHaveTextContent("—");
    expect(within(noTotalRow).getAllByRole("cell")[6]).toHaveTextContent("—");
    // No year, no second line.
    expect(within(row.querySelectorAll("td")[2] as HTMLElement).queryByText(/^\d{4}$/)).toBeNull();
  });

  it("marks an archived client in the Cliente column", () => {
    const archived = { ...ACTIVE, client: { ...ACTIVE.client!, enabled: false } };
    renderTable({ ok: true, rows: [archived], matching: 1, total: 1 });
    const cell = screen.getByText("Ana Gómez").closest("td")!;
    expect(within(cell).getByText("Archivado")).toBeInTheDocument();
  });

  it("sorts ascending on the first click, the last update included, and reverses on the second", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Actualizado/ }));
    expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?orden=actualizado");

    nav.search = "orden=actualizado";
    nav.replace.mockReset();
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getAllByRole("button", { name: /Actualizado/ })[1]);
    expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?orden=actualizado&sentido=desc");
  });

  it("announces the sorted column and its direction", () => {
    nav.search = "orden=estado&sentido=desc";
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getByRole("columnheader", { name: /Estado/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("keeps the filters in the URL when sorting", () => {
    nav.search = "estado=entregado&desde=2026-09-01";
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Kilometraje/ }));
    expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?orden=km&desde=2026-09-01&estado=entregado");
  });

  it("pages and shows the range", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 60, total: 60 });
    expect(screen.getByText("Mostrando 1–25 de 60")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?pagina=2");
  });

  it("opens the job modal from a row, with the plate and the vehicle in its title", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByText("Fiat Cronos"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Fiat Cronos 2021")).toBeInTheDocument();
  });

  it("opens the job modal from the keyboard", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.keyDown(screen.getByText("Fiat Cronos").closest("tr")!, { key: "Enter" });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  describe("while loading", () => {
    it("keeps the header and its sort buttons, shows placeholders instead of the old rows, and announces once", () => {
      renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1, pending: true });
      expect(screen.getByRole("button", { name: /Estado/ })).toBeInTheDocument();
      expect(screen.queryByText("Fiat Cronos")).toBeNull();
      expect(screen.getAllByText("Cargando…")).toHaveLength(1);
      expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    });

    it("shows the skeleton in the final sizes with the same headers", () => {
      renderWithIntl(<JobsTableSkeleton />);
      // The skeleton region is busy, so it is hidden from the accessibility tree.
      expect(screen.getAllByRole("columnheader", { hidden: true }).map((header) => header.textContent)).toEqual([
        "N°",
        "Patente",
        "Vehículo",
        "Cliente",
        "Estado",
        "Kilometraje",
        "Total",
        "Actualizado",
      ]);
      expect(screen.getAllByText("Cargando…")).toHaveLength(1);
    });
  });

  describe("states", () => {
    it("offers to retry when the list fails", () => {
      const onRetry = vi.fn();
      renderTable({ ok: false, onRetry });
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("says nothing matched and clears the search and every filter", () => {
      nav.search = "estado=entregado&desde=2026-09-01&archivados=1&orden=km";
      renderTable({ ok: true, rows: [], matching: 0, total: 5 });
      expect(screen.getByText("No encontramos trabajos")).toBeInTheDocument();
      expect(screen.getByText("Probá con otro número, patente, marca, modelo o cliente.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda y filtros" }));
      expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?archivados=1&orden=km");
    });

    it("invites to create the first job when there are none", async () => {
      renderTable({ ok: true, rows: [], matching: 0, total: 0 });
      expect(screen.getByText("Todavía no hay trabajos")).toBeInTheDocument();
      expect(screen.getByText("Creá el primero para registrar el trabajo de un vehículo.")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Nuevo trabajo" })).toHaveLength(2);
    });

    it("points to Mostrar archivados when every job is archived", () => {
      renderTable({ ok: true, rows: [], matching: 0, total: 3 });
      expect(screen.getByText("No hay trabajos activos")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Mostrar archivados" }));
      expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos?archivados=1");
    });

    it("goes back to the first page when the current one is past the end", () => {
      nav.search = "pagina=4";
      renderTable({ ok: true, rows: [], matching: 0, total: 5 });
      expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/trabajos");
    });
  });

  it("opens the creation form from the button without waiting for a row", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Nuevo trabajo" })));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Nuevo trabajo")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Agregar trabajo" })).toBeInTheDocument();
  });
});
