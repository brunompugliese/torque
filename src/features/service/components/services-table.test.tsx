import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import type { Service } from "../schemas";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), refresh: vi.fn() }));
vi.spyOn(window.history, "replaceState").mockImplementation((...args) => nav.replace(...args));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh }),
  usePathname: () => "/servicios",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("../actions", () => ({
  createService: vi.fn(),
  updateService: vi.fn(),
  setServiceArchived: vi.fn(),
  searchServices: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { AddServiceButton } from "./add-service-button";
import { ServicesPanel } from "./services-panel";
import { ServicesTable, ServicesTableSkeleton } from "./services-table";
import { ServicesListView } from "./services-list";

const ACTIVE: Service = {
  id: "s1",
  name: "Alineación",
  description: "Tren delantero.\nIncluye cámber.",
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
};
const ARCHIVED: Service = { ...ACTIVE, id: "s2", name: "Lavado de motor", description: null, enabled: false };

function renderTable(props: Parameters<typeof ServicesTable>[0]) {
  return renderWithIntl(
    <ServicesPanel>
      <AddServiceButton />
      <ServicesTable {...props} />
    </ServicesPanel>,
  );
}

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
  nav.refresh.mockReset();
});

describe("ServicesTable", () => {
  it("lists services with the description below and archived rows greyed with a badge", () => {
    renderTable({ ok: true, rows: [ACTIVE, ARCHIVED], matching: 2, total: 2 });

    const table = screen.getByRole("table", { name: "Servicios" });
    const [nameHeader, createdHeader] = within(table).getAllByRole("columnheader");
    expect(nameHeader).not.toHaveAttribute("aria-sort");
    expect(createdHeader).toHaveTextContent("Creado el");
    expect(createdHeader).not.toHaveAttribute("aria-sort");
    const dates = within(table).getAllByText("13/10/2026");
    expect(dates).toHaveLength(2);
    expect(dates[0]).toHaveClass("text-muted-foreground");
    expect(within(table).getByText("Tren delantero. Incluye cámber.", { normalizer: (text) => text.replace(/\s+/g, " ") })).toHaveClass("truncate");

    const archivedRow = within(table).getByText("Lavado de motor").closest("tr")!;
    expect(archivedRow).toHaveAttribute("data-muted", "true");
    expect(within(archivedRow).getByText("Archivado")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1–2 de 2")).toHaveAttribute("aria-live", "polite");
  });

  it("sorts by Servicio A–Z from its header, then reverses it", () => {
    nav.search = "pagina=2";
    renderTable({ ok: true, rows: [ACTIVE], matching: 30, total: 30 });
    fireEvent.click(within(screen.getAllByRole("columnheader")[0]).getByRole("button"));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/servicios?orden=nombre");
  });

  it("reverses the sorted column", () => {
    nav.search = "orden=nombre";
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(within(screen.getAllByRole("columnheader")[0]).getByRole("button"));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/servicios?orden=nombre&sentido=desc");
  });

  it("sorts by Creado el from its header", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(within(screen.getAllByRole("columnheader")[1]).getByRole("button"));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/servicios?orden=creado");
  });

  it("marks Creado el as sorted when the URL says so", () => {
    nav.search = "orden=creado&sentido=desc";
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    const [nameHeader, createdHeader] = screen.getAllByRole("columnheader");
    expect(createdHeader).toHaveAttribute("aria-sort", "descending");
    expect(nameHeader).not.toHaveAttribute("aria-sort");
  });

  it("pages through the list", () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 30, total: 30 });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/servicios?pagina=2");
  });

  it("opens the service modal from a row", async () => {
    renderTable({ ok: true, rows: [ACTIVE], matching: 1, total: 1 });
    fireEvent.click(screen.getByText("Alineación").closest("tr")!);
    expect(await screen.findByRole("dialog", { name: "Alineación" })).toBeInTheDocument();
  });

  it("shows no results for a search with a way to clear it", () => {
    nav.search = "buscar=xyz";
    renderTable({ ok: true, rows: [], matching: 0, total: 4 });
    expect(screen.getByText("No encontramos servicios")).toBeInTheDocument();
    expect(screen.getByText("Probá con otro nombre o descripción.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/servicios");
  });

  it("invites to add the first service when there are none", async () => {
    renderTable({ ok: true, rows: [], matching: 0, total: 0 });
    expect(screen.getByText("Todavía no hay servicios")).toBeInTheDocument();
    const status = screen.getByRole("status");
    fireEvent.click(within(status).getByRole("button", { name: "Agregar servicio" }));
    expect(await screen.findByRole("dialog", { name: "Agregar servicio" })).toBeInTheDocument();
  });

  it("points to Mostrar archivados when every service is archived", () => {
    renderTable({ ok: true, rows: [], matching: 0, total: 3 });
    expect(screen.getByText("No hay servicios activos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar archivados" }));
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/servicios?archivados=1");
  });

  it("goes back to page 1 when the page is past the end", () => {
    nav.search = "pagina=3";
    renderTable({ ok: true, rows: [], matching: 50, total: 50 });
    expect(nav.replace).toHaveBeenCalledWith(null, "", "/servicios");
  });

  it("shows the error state and retries", () => {
    const onRetry = vi.fn();
    renderTable({ ok: false, onRetry });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("ServicesTableSkeleton", () => {
  it("shows the Servicio header and two-line placeholder rows in a busy region", () => {
    const { container } = renderWithIntl(<ServicesTableSkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Servicio")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton-block").length).toBeGreaterThan(0);
  });
});

describe("ServicesListView toolbar", () => {
  it("has the services placeholder and drives the URL", async () => {
    vi.useFakeTimers();
    try {
      renderWithIntl(
        <ServicesPanel>
          <ServicesListView initial={{ ok: true, rows: [ACTIVE], matching: 1 }} initialKey="" total={1} />
        </ServicesPanel>,
      );
      const search = screen.getByRole("searchbox", { name: "Buscar" });
      expect(search).toHaveAttribute("placeholder", "Buscar por nombre o descripción");

      fireEvent.change(search, { target: { value: "aceite" } });
      await act(async () => vi.advanceTimersByTime(300));
      expect(nav.replace).toHaveBeenCalledWith(null, "", "/servicios?buscar=aceite");

      fireEvent.click(screen.getByRole("switch", { name: "Mostrar archivados" }));
      expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/servicios?archivados=1");
    } finally {
      vi.useRealTimers();
    }
  });
});
