import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { ArchivedBadge } from "./archived-badge";
import { ListEmpty, ListError } from "./list-states";

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
