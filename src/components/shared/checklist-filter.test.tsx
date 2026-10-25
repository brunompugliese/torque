import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChecklistFilter, type ChecklistOption } from "./checklist-filter";

const OPTIONS: ChecklistOption[] = [
  { value: "a", label: "Pendiente", count: 4 },
  { value: "b", label: "En progreso", count: 0 },
  { value: "c", label: "Entregado", count: 12 },
];

describe("ChecklistFilter", () => {
  it("lists every option with its count", () => {
    render(<ChecklistFilter options={OPTIONS} selected={["c"]} onChange={() => {}} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: "Pendiente 4" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Entregado 12" })).toBeChecked();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("adds a choice to the selection in the options' order", () => {
    const onChange = vi.fn();
    render(<ChecklistFilter options={OPTIONS} selected={["c"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Pendiente 4" }));
    expect(onChange).toHaveBeenCalledWith(["a", "c"]);
  });

  it("removes a choice", () => {
    const onChange = vi.fn();
    render(<ChecklistFilter options={OPTIONS} selected={["a", "c"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Entregado 12" }));
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("toggles with a click on the label text", () => {
    function Harness() {
      const [selected, setSelected] = useState<string[]>([]);
      return <ChecklistFilter options={OPTIONS} selected={selected} onChange={setSelected} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByText("En progreso"));
    expect(screen.getByRole("checkbox", { name: /En progreso/ })).toBeChecked();
  });

  it("shows placeholders instead of the counts while they load", () => {
    const { container } = render(<ChecklistFilter options={OPTIONS} selected={[]} onChange={() => {}} loadingCounts />);
    expect(screen.queryByText("12")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: "Pendiente" })).toBeInTheDocument();
  });

  it("announces the loading once and marks the list busy", () => {
    render(
      <ChecklistFilter options={OPTIONS} selected={[]} onChange={() => {}} loadingCounts loadingLabel="Cargando…" />,
    );
    expect(screen.getAllByText("Cargando…")).toHaveLength(1);
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
  });

  it("announces nothing once the counts are there", () => {
    render(<ChecklistFilter options={OPTIONS} selected={[]} onChange={() => {}} loadingLabel="Cargando…" />);
    expect(screen.queryByText("Cargando…")).toBeNull();
    expect(screen.getByRole("list")).not.toHaveAttribute("aria-busy");
  });

  it("omits the count when there is none", () => {
    render(<ChecklistFilter options={[{ value: "a", label: "Pendiente" }]} selected={[]} onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Pendiente" })).toBeInTheDocument();
  });
});
