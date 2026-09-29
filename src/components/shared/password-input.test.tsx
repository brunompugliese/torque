import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "./password-input";

function renderInput() {
  render(
    <>
      <label htmlFor="pw">Contraseña</label>
      <PasswordInput id="pw" showLabel="Mostrar contraseña" hideLabel="Ocultar contraseña" />
    </>,
  );
  return screen.getByLabelText("Contraseña");
}

describe("PasswordInput", () => {
  it("hides the password by default", () => {
    expect(renderInput()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles visibility and updates the control's name and state", () => {
    const input = renderInput();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(input).toHaveAttribute("type", "text");
    const toggle = screen.getByRole("button", { name: "Ocultar contraseña" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("doesn't submit the surrounding form", () => {
    renderInput();
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute(
      "type",
      "button",
    );
  });
});
