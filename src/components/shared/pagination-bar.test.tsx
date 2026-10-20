import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { PaginationBar } from "./pagination-bar";

function renderBar(page: number, total: number) {
  const onPageChange = vi.fn();
  const result = renderWithIntl(<PaginationBar page={page} pageSize={25} total={total} onPageChange={onPageChange} />);
  return { onPageChange, ...result };
}

describe("PaginationBar", () => {
  it("shows the range and the pages", () => {
    renderBar(2, 140);
    expect(screen.getByText("Mostrando 26–50 de 140")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Paginación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Página 6" })).toBeInTheDocument();
  });

  it("moves between pages", () => {
    const { onPageChange } = renderBar(2, 140);
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Página 6" }));
    expect(onPageChange.mock.calls).toEqual([[1], [3], [6]]);
  });

  it("disables Anterior on the first page and Siguiente on the last", () => {
    renderBar(1, 30);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });

  it("shows only the range when everything fits in one page", () => {
    renderBar(1, 3);
    expect(screen.getByText("Mostrando 1–3 de 3")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders nothing for an empty list", () => {
    const { container } = renderBar(1, 0);
    expect(container).toBeEmptyDOMElement();
  });
});
