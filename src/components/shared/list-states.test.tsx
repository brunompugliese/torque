import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { ArchivedBadge } from "./archived-badge";
import { ListEmpty, ListError, ListNoRows } from "./list-states";

describe("ListEmpty", () => {
  it("shows the title, the hint and the way out", () => {
    renderWithIntl(
      <ListEmpty
        title="No encontramos servicios"
        hint="Probá con otro nombre o descripción."
        action={<button type="button">Borrar búsqueda</button>}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No encontramos servicios");
    expect(screen.getByText("Probá con otro nombre o descripción.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar búsqueda" })).toBeInTheDocument();
  });
});

describe("ListError", () => {
  it("explains the failure and retries", () => {
    const onRetry = vi.fn();
    renderWithIntl(<ListError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar la lista");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("ArchivedBadge", () => {
  it("says Archivado", () => {
    renderWithIntl(<ArchivedBadge />);
    expect(screen.getByText("Archivado")).toBeInTheDocument();
  });
});

describe("ListNoRows", () => {
  const texts = {
    noResultsTitle: "No encontramos cosas",
    noResultsHint: "Probá con otro nombre.",
    noneTitle: "Todavía no hay cosas",
    noneHint: "Agregá la primera.",
    onlyArchivedTitle: "No hay cosas activas",
    onlyArchivedHint: "Activá Mostrar archivados.",
  };

  function renderNoRows(props: { hasSearch: boolean; total: number }) {
    const handlers = { onAdd: vi.fn(), onClearSearch: vi.fn(), onShowArchived: vi.fn() };
    renderWithIntl(<ListNoRows {...props} texts={texts} addLabel="Agregar cosa" {...handlers} />);
    return handlers;
  }

  it("says nothing matched a search and lets the user clear it", () => {
    const { onClearSearch, onAdd, onShowArchived } = renderNoRows({ hasSearch: true, total: 4 });
    expect(screen.getByText("No encontramos cosas")).toBeInTheDocument();
    expect(screen.getByText("Probá con otro nombre.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(onClearSearch).toHaveBeenCalledOnce();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onShowArchived).not.toHaveBeenCalled();
  });

  it("names what the clear button clears when the page says so", () => {
    const onClearSearch = vi.fn();
    renderWithIntl(
      <ListNoRows
        hasSearch
        total={4}
        texts={texts}
        addLabel="Agregar cosa"
        onAdd={vi.fn()}
        onClearSearch={onClearSearch}
        clearLabel="Limpiar búsqueda y filtros"
        onShowArchived={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda y filtros" }));
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it("a search wins even when there are no records at all", () => {
    renderNoRows({ hasSearch: true, total: 0 });
    expect(screen.getByText("No encontramos cosas")).toBeInTheDocument();
  });

  it("invites to add the first record when there are none", () => {
    const { onAdd } = renderNoRows({ hasSearch: false, total: 0 });
    expect(screen.getByText("Todavía no hay cosas")).toBeInTheDocument();
    expect(screen.getByText("Agregá la primera.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agregar cosa" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("points to Mostrar archivados when every record is archived", () => {
    const { onShowArchived } = renderNoRows({ hasSearch: false, total: 3 });
    expect(screen.getByText("No hay cosas activas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar archivados" }));
    expect(onShowArchived).toHaveBeenCalledOnce();
  });
});
