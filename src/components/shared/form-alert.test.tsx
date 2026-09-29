import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormAlert } from "./form-alert";

describe("FormAlert", () => {
  it("announces the message to screen readers", () => {
    render(<FormAlert>Email o contraseña incorrectos.</FormAlert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Email o contraseña incorrectos.");
  });

  it("uses a translucent error tint and border from theme tokens", () => {
    render(<FormAlert>Error</FormAlert>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("bg-destructive/10", "border-destructive/30", "text-destructive");
    expect(alert).not.toHaveClass("bg-card");
  });

  it("hides its icon from assistive technology", () => {
    render(<FormAlert>Error</FormAlert>);
    expect(screen.getByRole("alert").querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
