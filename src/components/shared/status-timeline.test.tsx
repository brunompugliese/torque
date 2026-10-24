import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusTimeline } from "./status-timeline";

const ENTRIES = [
  { id: "3", title: "Entregado", meta: "Usuario A · 22/10/2026 21:47" },
  { id: "2", title: "Completado", meta: "Usuario B · 21/10/2026 10:00" },
  { id: "1", title: "Pendiente" },
];

describe("StatusTimeline", () => {
  it("is a list in the order given, so a screen reader counts the entries", () => {
    render(<StatusTimeline entries={ENTRIES} ariaLabel="Historial de estados" />);
    const items = within(screen.getByRole("list", { name: "Historial de estados" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Entregado");
    expect(items[2]).toHaveTextContent("Pendiente");
  });

  it("shows the title and the meta line", () => {
    render(<StatusTimeline entries={ENTRIES} />);
    expect(screen.getByText("Entregado")).toBeInTheDocument();
    expect(screen.getByText("Usuario A · 22/10/2026 21:47")).toBeInTheDocument();
  });

  it("works without a meta line", () => {
    render(<StatusTimeline entries={[{ id: "1", title: "Pendiente" }]} />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("draws one connector per gap, from a node to the next one, and none after the last", () => {
    render(<StatusTimeline entries={ENTRIES} />);
    const items = screen.getAllByRole("listitem");
    const connectors = items.map((item) => item.querySelectorAll("span.w-px").length);
    expect(connectors).toEqual([1, 1, 0]);
    // The connector reaches into the next entry (negative bottom), so there is no gap.
    for (const item of items.slice(0, 2)) expect(item.querySelector("span.w-px")).toHaveClass("-bottom-3");
  });

  it("hides the rail from screen readers", () => {
    render(<StatusTimeline entries={ENTRIES} />);
    for (const rail of document.querySelectorAll("li > span")) expect(rail).toHaveAttribute("aria-hidden", "true");
  });
});
