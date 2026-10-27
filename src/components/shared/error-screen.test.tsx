import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorScreen } from "./error-screen";

const base = { title: "Algo salió mal", hint: "Probá de nuevo.", retryLabel: "Reintentar", onRetry: () => {} };

describe("ErrorScreen", () => {
  it("is announced as an alert with its title and hint", () => {
    render(<ErrorScreen {...base} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal");
    expect(screen.getByRole("alert")).toHaveTextContent("Probá de nuevo.");
  });

  it("moves focus to the title", () => {
    render(<ErrorScreen {...base} />);
    expect(screen.getByRole("heading", { name: "Algo salió mal" })).toHaveFocus();
  });

  it("calls onRetry from the retry button", () => {
    const onRetry = vi.fn();
    render(<ErrorScreen {...base} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("links home only when given a home link", () => {
    const { rerender } = render(<ErrorScreen {...base} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(<ErrorScreen {...base} home={{ label: "Ir al inicio", href: "/inicio" }} />);
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/inicio");
  });

  it("shows the code only when given one", () => {
    const { rerender } = render(<ErrorScreen {...base} />);
    expect(screen.queryByText(/Código/)).not.toBeInTheDocument();
    rerender(<ErrorScreen {...base} code="Código: 3849201746" />);
    expect(screen.getByText("Código: 3849201746")).toBeInTheDocument();
  });
});
