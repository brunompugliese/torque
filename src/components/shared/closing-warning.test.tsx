import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClosingWarning } from "./closing-warning";

describe("ClosingWarning", () => {
  it("is announced and carries the message in text", () => {
    render(<ClosingWarning>Al guardar como entregado, el trabajo queda cerrado.</ClosingWarning>);
    expect(screen.getByRole("status")).toHaveTextContent("Al guardar como entregado, el trabajo queda cerrado.");
  });

  it("uses the warning colors", () => {
    render(<ClosingWarning>Aviso</ClosingWarning>);
    expect(screen.getByRole("status")).toHaveClass("bg-warning", "border-warning-border", "text-warning-foreground");
  });
});
