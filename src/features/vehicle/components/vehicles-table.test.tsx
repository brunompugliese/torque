import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ListSearchProvider } from "@/components/shared/list-search-provider";
import { renderWithIntl } from "@/test/render";

import type { VehicleListItem } from "../schemas";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.spyOn(window.history, "replaceState").mockImplementation((...args) => nav.replace(...args));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vehiculos",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("../actions", () => ({
  searchVehicles: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  setVehicleArchived: vi.fn(),
  getBrandOptions: vi.fn(async () => ({ ok: true, rows: [] })),
  getModelOptions: vi.fn(async () => ({ ok: true, rows: [] })),
}));
vi.mock("@/features/client/actions", () => ({ searchClientOptions: vi.fn(async () => ({ ok: true, rows: [] })) }));
vi.mock("@/features/job/actions", () => ({ getVehicleJobs: vi.fn(async () => ({ ok: true, rows: [] })) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { AddVehicleButton } from "./add-vehicle-button";
import { VehiclesListView } from "./vehicles-list";
import { VehiclesPanel } from "./vehicles-panel";
import { VehiclesTable, VehiclesTableSkeleton } from "./vehicles-table";

// The panel loads its modal lazily; loading it up front keeps the first
// "opens the modal" test from racing the import.
beforeAll(async () => {
  await import("./vehicle-modal");
});

const ACTIVE: VehicleListItem = {
  id: "v1",
  plate: "AB123CD",
  brandId: "b1",
  modelId: "m1",
  brandName: "Fiat",
  modelName: "Cronos",
  year: 2021,
  vin: "8AP359A1XMU123456",
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  lastKm: 112500,
  client: { id: "c1", name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
};
const BARE: VehicleListItem = {
  ...ACTIVE,
  id: "v2",
  plate: "ABC123",
  brandName: "Volkswagen",
  modelName: "Gol",
  year: null,
  vin: null,
  enabled: false,
  lastKm: null,
  client: null,
};

function renderTable(props: Parameters<typeof VehiclesTable>[0]) {
  return renderWithIntl(
    <ListSearchProvider>
      <VehiclesPanel>
        <AddVehicleButton />
        <VehiclesTable {...props} />
      </VehiclesPanel>
    </ListSearchProvider>,
  );
}

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
});

describe("VehiclesTable", () => {
  it("lists the seven columns with no header marked as sorted", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const table = screen.getByRole("table", { name: "Vehículos" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Patente",
      "Vehículo",
      "Año",
      "VIN",
      "Cliente",
      "Último km",
      "Creado el",
    ]);
    for (const header of headers) {
      expect(header).not.toHaveAttribute("aria-sort");
      expect(within(header).getByRole("button")).toBeInTheDocument();
    }
  });

  it("shows the plate drawn, brand and model, year, VIN, client, last km and date", () => {
    const { container } = renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const row = screen.getByText("Fiat Cronos").closest("tr")!;
    expect(container.querySelector('[data-slot="plate"]')).toHaveTextContent("AB 123 CD");
    expect(within(row).getByText("2021")).toHaveClass("tabular-nums");
    expect(within(row).getByText("8AP359A1XMU123456")).toHaveClass("tabular-nums");
    expect(within(row).getByText("Ana Gómez")).toHaveClass("truncate");
    expect(within(row).getByText("112.500 km")).toHaveClass("tabular-nums");
    expect(within(row).getByText("13/10/2026")).toHaveClass("text-muted-foreground");
    expect(within(row).queryByText("Archivado")).not.toBeInTheDocument();
  });

  it("aligns the plate to the center and the year and km to the right, headers included", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getByRole("columnheader", { name: /Patente/ })).toHaveClass("text-center");
    expect(screen.getByRole("columnheader", { name: /Año/ })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: /Último km/ })).toHaveClass("text-right");
    expect(screen.getByText("2021").closest("td")).toHaveClass("text-right");
    expect(screen.getByText("112.500 km").closest("td")).toHaveClass("text-right");
  });

  it("keeps the Vehículo column readable on a narrow screen, header included", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getByRole("columnheader", { name: /Vehículo/ })).toHaveClass("min-w-44");
    expect(screen.getByText("Fiat Cronos").closest("td")).toHaveClass("min-w-44");
  });

  it("shows dashes for empty values, Sin cliente, and archived rows greyed with a badge", () => {
    renderTable({ ok: true, rows: [BARE], matching: 1, total: 1 });
    const row = screen.getByText("Volkswagen Gol").closest("tr")!;
    expect(row).toHaveAttribute("data-muted", "true");
    expect(within(row).getByText("Archivado")).toBeInTheDocument();
    const cells = within(row).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("—");
    expect(cells[3]).toHaveTextContent("—");
    expect(cells[4]).toHaveTextContent("Sin cliente");
    expect(cells[5]).toHaveTextContent("—");
  });

  it("marks an archived client in the Cliente column and shows a client without surname by name", () => {
    renderTable({
      ok: true,
      rows: [
        { ...ACTIVE, client: { id: "c1", name: "Ana", surname: "Gómez", phoneNumber: "11 1", enabled: false } },
        { ...BARE, enabled: true, client: { id: "c2", name: "Zoe", surname: null, phoneNumber: "11 2", enabled: true } },
      ],
      matching: 2,
      total: 2,
    });
    expect(screen.getByText("Ana Gómez")).toHaveClass("text-muted-foreground");
    expect(screen.getAllByText("Archivado")).toHaveLength(1);
    expect(screen.getByText("Zoe")).toBeInTheDocument();
  });

  it("announces the range", () => {
    renderTable({ ok: true, rows: [ACTIVE, BARE], matching: 2, total: 2 });
    expect(screen.getByText("Mostrando 1–2 de 2")).toHaveAttribute("aria-live", "polite");
  });

  it.each([
    [0, "patente"],
    [1, "vehiculo"],
    [2, "anio"],
    [3, "vin"],
    [4, "cliente"],
    [5, "km"],
    [6, "creado"],
  ])("sorts column %i ascending on its first click", (index, id) => {
    nav.search = "pagina=2";
    renderTable({ ok: true, rows: [ACTIVE], matching: 30, total: 30 });
    fireEvent.click(within(screen.getAllByRole("columnheader")[index]).getByRole("button"));
    expect(nav.replace).toHaveBeenCalledWith(null, "", `/vehiculos?orden=${id}`);
  });

  it("reverses the sorted column and announces its direction", () => {
    nav.search = "orden=km";
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const header = screen.getAllByRole("columnheader")[5];
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(within(header).getByText("ordenado de la A a la Z")).toBeInTheDocument();
    fireEvent.click(within(header).getByRole("button"));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/vehiculos?orden=km&sentido=desc");
  });

  it("pages through the list", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 30, total: 30 });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/vehiculos?pagina=2");
  });

  it("opens the vehicle modal from a row, with the client's WhatsApp button", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByText("Fiat Cronos").closest("tr")!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Fiat Cronos 2021")).toBeInTheDocument();
    expect(within(dialog).getByText("8AP359A1XMU123456")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5491112345678",
    );
  });

  it("opens the modal from the keyboard", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.keyDown(screen.getByText("Fiat Cronos").closest("tr")!, { key: "Enter" });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("invites to add the first vehicle when there are none", () => {
    renderTable({ ok: true, rows: [], matching: 0, total: 0 });
    expect(screen.getByText("Todavía no hay vehículos")).toBeInTheDocument();
    expect(screen.getByText("Agregá el primero para registrar sus trabajos.")).toBeInTheDocument();
    expect(within(screen.getByRole("status")).getByRole("button", { name: "Agregar vehículo" })).toBeInTheDocument();
  });

  it("opens the create form from Agregar vehículo", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Agregar vehículo" }));
    expect(await screen.findByRole("dialog", { name: "Agregar vehículo" })).toBeInTheDocument();
  });

  it("points to Mostrar archivados when every vehicle is archived", () => {
    renderTable({ ok: true, rows: [], matching: 0, total: 3 });
    expect(screen.getByText("No hay vehículos activos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar archivados" }));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/vehiculos?archivados=1");
  });

  it("goes back to page 1 when the page is past the end", () => {
    nav.search = "pagina=3";
    renderTable({ ok: true, rows: [], matching: 50, total: 50 });
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/vehiculos");
  });

  it("shows the error state and retries", () => {
    const onRetry = vi.fn();
    renderTable({ ok: false, onRetry });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("VehiclesTableSkeleton", () => {
  it("shows the seven headers and placeholder rows in a busy region announced once", () => {
    const { container } = renderWithIntl(<VehiclesTableSkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    for (const header of ["Patente", "Vehículo", "Año", "VIN", "Cliente", "Último km", "Creado el"]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId("skeleton-block").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

function renderListView() {
  return renderWithIntl(
    <ListSearchProvider>
      <VehiclesPanel>
        <VehiclesListView initial={{ ok: true, rows: [ACTIVE], matching: 1 }} initialKey="" total={1} />
      </VehiclesPanel>
    </ListSearchProvider>,
  );
}

describe("VehiclesListView while a search, sort or page loads", () => {
  it("shows placeholder rows instead of the old ones while a search loads, keeping the toolbar and the header", async () => {
    vi.useFakeTimers();
    try {
      const { searchVehicles } = await import("../actions");
      let resolve: (page: Awaited<ReturnType<typeof searchVehicles>>) => void = () => {};
      vi.mocked(searchVehicles).mockReturnValue(new Promise((done) => (resolve = done)));
      renderListView();
      expect(screen.getByText("Fiat Cronos")).toBeInTheDocument();
      expect(screen.queryByTestId("skeleton-block")).toBeNull();

      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "gol" } });
      await act(async () => vi.advanceTimersByTime(300));

      expect(screen.queryByText("Fiat Cronos")).toBeNull();
      expect(screen.getAllByTestId("skeleton-block").length).toBeGreaterThan(0);
      expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
      expect(screen.getByRole("searchbox")).toHaveValue("gol");
      expect(screen.getAllByRole("columnheader")).toHaveLength(7);
      expect(screen.queryByText(/Mostrando/)).toBeNull();

      await act(async () => resolve({ ok: true, rows: [BARE], matching: 1 }));
      expect(screen.getByText("Volkswagen Gol")).toBeInTheDocument();
      expect(screen.queryByTestId("skeleton-block")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("VehiclesListView toolbar", () => {
  it("has the vehicles placeholder, searches without touching the URL, and drives the archived switch there", async () => {
    vi.useFakeTimers();
    try {
      const { searchVehicles } = await import("../actions");
      vi.mocked(searchVehicles).mockResolvedValue({ ok: true, rows: [ACTIVE], matching: 1 });
      renderListView();
      const search = screen.getByRole("searchbox", { name: "Buscar" });
      expect(search).toHaveAttribute("placeholder", "Buscar por patente, marca, modelo o VIN");

      fireEvent.change(search, { target: { value: "ae 482" } });
      await act(async () => vi.advanceTimersByTime(300));
      // The search never reaches the address bar, but it does reach the action.
      expect(nav.replace).toHaveBeenCalledWith(null, "", "/vehiculos");
      for (const [, , url] of nav.replace.mock.calls) expect(String(url)).not.toContain("ae");
      expect(searchVehicles).toHaveBeenCalledWith("buscar=ae+482");

      fireEvent.click(screen.getByRole("switch", { name: "Mostrar archivados" }));
      expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/vehiculos?archivados=1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("has only the search and the archived switch", () => {
    renderListView();
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("clears a search from the empty state without leaving anything in the URL", async () => {
    vi.useFakeTimers();
    try {
      const { searchVehicles } = await import("../actions");
      vi.mocked(searchVehicles).mockResolvedValue({ ok: true, rows: [], matching: 0 });
      renderListView();
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
      await act(async () => vi.advanceTimersByTime(300));
      await act(async () => {});
      expect(screen.getByText("No encontramos vehículos")).toBeInTheDocument();
      expect(screen.getByText("Probá con otra patente, marca, modelo o VIN.")).toBeInTheDocument();

      nav.replace.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
      expect(screen.getByRole("searchbox")).toHaveValue("");
      expect(nav.replace).toHaveBeenCalledWith(null, "", "/vehiculos");
    } finally {
      vi.useRealTimers();
    }
  });
});
