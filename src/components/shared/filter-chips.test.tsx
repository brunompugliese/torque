import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterChips } from "./filter-chips";

const CHIPS = [
  { id: "estado:entregado", label: "Entregado", removeLabel: "Quitar filtro: Entregado" },
  { id: "fecha", label: "Actualizado: 01/09/2026 al 30/09/2026", removeLabel: "Quitar filtro: Actualizado" },
];

describe("FilterChips", () => {
  it("renders nothing without chips", () => {
    const { container } = render(<FilterChips chips={[]} onRemove={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the active filters", () => {
    render(<FilterChips chips={CHIPS} onRemove={() => {}} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Entregado")).toBeInTheDocument();
    expect(screen.getByText("Actualizado: 01/09/2026 al 30/09/2026")).toBeInTheDocument();
  });

  it("removes a filter from its button, which says what it does", () => {
    const onRemove = vi.fn();
    render(<FilterChips chips={CHIPS} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro: Entregado" }));
    expect(onRemove).toHaveBeenCalledWith("estado:entregado");
  });
});
