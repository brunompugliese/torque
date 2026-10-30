import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ListSearchProvider } from "@/components/shared/list-search-provider";
import { renderWithIntl } from "@/test/render";

import type { Client } from "../schemas";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), refresh: vi.fn() }));
vi.spyOn(window.history, "replaceState").mockImplementation((...args) => nav.replace(...args));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh }),
  usePathname: () => "/clientes",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("../actions", () => ({
  searchClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  setClientArchived: vi.fn(),
}));
vi.mock("@/features/vehicle/actions", () => ({
  getClientVehicles: vi.fn(async () => ({ ok: true, rows: [] })),
  getUnassignedVehicles: vi.fn(async () => ({ ok: true, rows: [] })),
  assignVehiclesToClient: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { AddClientButton } from "./add-client-button";
import { ClientsPanel } from "./clients-panel";
import { ClientsTable, ClientsTableSkeleton } from "./clients-table";
import { ClientsListView } from "./clients-list";

// The panel loads its modal lazily; loading it up front keeps the first
// "opens the modal" test from racing the import.
beforeAll(async () => {
  await import("./client-modal");
});

const ACTIVE: Client = {
  id: "c1",
  name: "Ana",
  surname: "Gómez",
  dni: "28456123",
  phoneNumber: "11 12345678",
  email: "ana@example.com",
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
};
const ARCHIVED: Client = {
  ...ACTIVE,
  id: "c2",
  name: "Zoe",
  surname: null,
  dni: null,
  email: null,
  enabled: false,
};

function renderTable(props: Parameters<typeof ClientsTable>[0]) {
  return renderWithIntl(
    <ListSearchProvider>
      <ClientsPanel>
        <AddClientButton />
        <ClientsTable {...props} />
      </ClientsPanel>
    </ListSearchProvider>,
  );
}

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
  nav.refresh.mockReset();
});

describe("ClientsTable", () => {
  it("lists the five columns with no header marked as sorted", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const table = screen.getByRole("table", { name: "Clientes" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["Cliente", "DNI", "Teléfono", "Email", "Creado el"]);
    for (const header of headers) {
      expect(header).not.toHaveAttribute("aria-sort");
      expect(within(header).getByRole("button")).toBeInTheDocument();
    }
  });

  it("shows name and surname, the DNI with dots, the phone as entered, the email and the date", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const row = screen.getByText("Ana Gómez").closest("tr")!;
    expect(within(row).getByText("28.456.123")).toHaveClass("tabular-nums");
    expect(within(row).getByText("11 12345678")).toBeInTheDocument();
    expect(within(row).getByText("ana@example.com")).toHaveClass("truncate");
    expect(within(row).getByText("13/10/2026")).toHaveClass("text-muted-foreground");
    expect(within(row).queryByText("Archivado")).not.toBeInTheDocument();
  });

  it("keeps the Cliente column readable on a narrow screen with a minimum width, header included", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getByRole("columnheader", { name: /Cliente/ })).toHaveClass("min-w-44");
    expect(screen.getByText("Ana Gómez").closest("td")).toHaveClass("min-w-44");
  });

  it("aligns the DNI column to the right, header included", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getByRole("columnheader", { name: /DNI/ })).toHaveClass("text-right");
    expect(screen.getByText("28.456.123").closest("td")).toHaveClass("text-right");
  });

  it("shows only the name without a surname, a dash for empty values, and archived rows greyed with a badge", () => {
    renderTable({ ok: true, rows: [ARCHIVED], matching: 1, total: 1 });
    const row = screen.getByText("Zoe").closest("tr")!;
    expect(row).toHaveAttribute("data-muted", "true");
    expect(within(row).getByText("Archivado")).toBeInTheDocument();
    const cells = within(row).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("—");
    expect(cells[3]).toHaveTextContent("—");
  });

  it("announces the range", () => {
    renderTable({ ok: true, rows: [ACTIVE, ARCHIVED], matching: 2, total: 2 });
    expect(screen.getByText("Mostrando 1–2 de 2")).toHaveAttribute("aria-live", "polite");
  });

  it.each([
    [0, "cliente"],
    [1, "dni"],
    [2, "telefono"],
    [3, "email"],
    [4, "creado"],
  ])("sorts column %i ascending on its first click", (index, id) => {
    nav.search = "pagina=2";
    renderTable({ ok: true, rows: [ACTIVE], matching: 30, total: 30 });
    fireEvent.click(within(screen.getAllByRole("columnheader")[index]).getByRole("button"));
    expect(nav.replace).toHaveBeenCalledWith(null, "", `/clientes?orden=${id}`);
  });

  it("reverses the sorted column and announces its direction", () => {
    nav.search = "orden=dni";
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const header = screen.getAllByRole("columnheader")[1];
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(within(header).getByText("ordenado de la A a la Z")).toBeInTheDocument();
    fireEvent.click(within(header).getByRole("button"));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/clientes?orden=dni&sentido=desc");
  });

  it("pages through the list", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 30, total: 30 });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/clientes?pagina=2");
  });

  it("opens the client modal from a row, with the WhatsApp button", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByText("Ana Gómez").closest("tr")!);
    const dialog = await screen.findByRole("dialog", { name: "Ana Gómez" });
    expect(within(dialog).getByText("28.456.123")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5491112345678",
    );
  });

  it("opens the modal from the keyboard", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.keyDown(screen.getByText("Ana Gómez").closest("tr")!, { key: "Enter" });
    expect(await screen.findByRole("dialog", { name: "Ana Gómez" })).toBeInTheDocument();
  });

  it("invites to add the first client when there are none", () => {
    renderTable({ ok: true, rows: [], matching: 0, total: 0 });
    expect(screen.getByText("Todavía no hay clientes")).toBeInTheDocument();
    expect(screen.getByText("Agregá el primero para asociarlo a sus vehículos.")).toBeInTheDocument();
    expect(within(screen.getByRole("status")).getByRole("button", { name: "Agregar cliente" })).toBeInTheDocument();
  });

  it("opens the create form from Agregar cliente", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Agregar cliente" }));
    expect(await screen.findByRole("dialog", { name: "Agregar cliente" })).toBeInTheDocument();
  });

  it("points to Mostrar archivados when every client is archived", () => {
    renderTable({ ok: true, rows: [], matching: 0, total: 3 });
    expect(screen.getByText("No hay clientes activos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar archivados" }));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/clientes?archivados=1");
  });

  it("goes back to page 1 when the page is past the end", () => {
    nav.search = "pagina=3";
    renderTable({ ok: true, rows: [], matching: 50, total: 50 });
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/clientes");
  });

  it("shows the error state and retries", () => {
    const onRetry = vi.fn();
    renderTable({ ok: false, onRetry });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("ClientsTableSkeleton", () => {
  it("shows the five headers and placeholder rows in a busy region announced once", () => {
    const { container } = renderWithIntl(<ClientsTableSkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    for (const header of ["Cliente", "DNI", "Teléfono", "Email", "Creado el"]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId("skeleton-block").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

function renderListView() {
  return renderWithIntl(
    <ListSearchProvider>
      <ClientsPanel>
        <ClientsListView initial={{ ok: true, rows: [ACTIVE], matching: 1 }} initialKey="" total={1} />
      </ClientsPanel>
    </ListSearchProvider>,
  );
}

describe("ClientsListView while a search, sort or page loads", () => {
  it("shows placeholder rows instead of the old ones while a search loads, keeping the toolbar and the header, then the new results", async () => {
    vi.useFakeTimers();
    try {
      const { searchClients } = await import("../actions");
      let resolve: (page: Awaited<ReturnType<typeof searchClients>>) => void = () => {};
      vi.mocked(searchClients).mockReturnValue(new Promise((done) => (resolve = done)));
      renderListView();
      expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
      expect(screen.queryByTestId("skeleton-block")).toBeNull();

      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zoe" } });
      await act(async () => vi.advanceTimersByTime(300));

      expect(searchClients).toHaveBeenCalledWith("buscar=zoe");
      expect(screen.queryByText("Ana Gómez")).toBeNull();
      expect(screen.getAllByTestId("skeleton-block").length).toBeGreaterThan(0);
      expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
      expect(screen.getByRole("searchbox")).toHaveValue("zoe");
      expect(screen.getAllByRole("columnheader")).toHaveLength(5);
      expect(screen.queryByText(/Mostrando/)).toBeNull();

      await act(async () => resolve({ ok: true, rows: [ARCHIVED], matching: 1 }));
      expect(screen.getByText("Zoe")).toBeInTheDocument();
      expect(screen.queryByTestId("skeleton-block")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ClientsListView toolbar", () => {
  it("has the clients placeholder, searches without touching the URL, and drives the archived switch there", async () => {
    vi.useFakeTimers();
    try {
      const { searchClients } = await import("../actions");
      vi.mocked(searchClients).mockResolvedValue({ ok: true, rows: [ACTIVE], matching: 1 });
      renderListView();
      const search = screen.getByRole("searchbox", { name: "Buscar" });
      expect(search).toHaveAttribute("placeholder", "Buscar por nombre, apellido, DNI, teléfono o email");

      fireEvent.change(search, { target: { value: "35.123" } });
      await act(async () => vi.advanceTimersByTime(300));
      // The search never reaches the address bar, but it does reach the action.
      expect(nav.replace).toHaveBeenCalledWith(null, "", "/clientes");
      for (const [, , url] of nav.replace.mock.calls) expect(String(url)).not.toContain("35");
      expect(searchClients).toHaveBeenCalledWith("buscar=35.123");

      fireEvent.click(screen.getByRole("switch", { name: "Mostrar archivados" }));
      expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/clientes?archivados=1");
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
      const { searchClients } = await import("../actions");
      vi.mocked(searchClients).mockResolvedValue({ ok: true, rows: [], matching: 0 });
      renderListView();
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyz" } });
      await act(async () => vi.advanceTimersByTime(300));
      await act(async () => {});
      expect(screen.getByText("No encontramos clientes")).toBeInTheDocument();
      expect(screen.getByText("Probá con otro nombre, DNI, teléfono o email.")).toBeInTheDocument();

      nav.replace.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
      expect(screen.getByRole("searchbox")).toHaveValue("");
      expect(nav.replace).toHaveBeenCalledWith(null, "", "/clientes");
    } finally {
      vi.useRealTimers();
    }
  });
});
