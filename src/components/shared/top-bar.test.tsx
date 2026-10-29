import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TopBar } from "./top-bar";

describe("TopBar", () => {
  it("shows the app's mark and name without a shop", () => {
    const { container } = render(<TopBar appName="Torque" logoSrc="/logo" />);

    expect(screen.getByRole("banner")).toHaveTextContent(/^Torque$/);
    expect(container.querySelector('[data-slot="logo-mark"]')).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the shop's name instead of the app's", () => {
    render(<TopBar appName="Torque" shopName="Taller Ejemplo" />);

    expect(screen.getByRole("banner")).toHaveTextContent(/^Taller Ejemplo$/);
  });

  it("draws the shop's logo when it has one", () => {
    const { container } = render(<TopBar appName="Torque" shopName="Taller Ejemplo" logoSrc="/logo" />);

    expect(container.querySelector("img")).toHaveAttribute("src", "/logo");
  });

  it("draws the app's mark when the shop has no logo", () => {
    const { container } = render(<TopBar appName="Torque" shopName="Taller Ejemplo" />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="logo-mark"]')).toBeInTheDocument();
  });

  it("renders actions on the right", () => {
    render(<TopBar appName="Torque" actions={<button type="button">Cerrar sesión</button>} />);
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});
