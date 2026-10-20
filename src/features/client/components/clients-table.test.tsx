import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { ClientsToolbar } from "./clients-toolbar";

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
    <ClientsPanel>
      <AddClientButton />
      <ClientsTable {...props} />
    </ClientsPanel>,
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

  it("shows no results for a search with a way to clear it", () => {
    nav.search = "buscar=xyz";
    renderTable({ ok: true, rows: [], matching: 0, total: 4 });
    expect(screen.getByText("No encontramos clientes")).toBeInTheDocument();
    expect(screen.getByText("Probá con otro nombre, DNI, teléfono o email.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/clientes");
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

describe("ClientsToolbar", () => {
  it("has the clients placeholder and drives the URL", async () => {
    vi.useFakeTimers();
    try {
      renderWithIntl(<ClientsToolbar />);
      const search = screen.getByRole("searchbox", { name: "Buscar" });
      expect(search).toHaveAttribute("placeholder", "Buscar por nombre, apellido, DNI, teléfono o email");

      fireEvent.change(search, { target: { value: "35.123" } });
      await act(async () => vi.advanceTimersByTime(300));
      expect(nav.replace).toHaveBeenCalledWith(null, "", "/clientes?buscar=35.123");

      fireEvent.click(screen.getByRole("switch", { name: "Mostrar archivados" }));
      expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/clientes?archivados=1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("has only the search and the archived switch", () => {
    renderWithIntl(<ClientsToolbar />);
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
