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

  it("credits the app under the shop's name", () => {
    render(<TopBar appName="Torque" byline="by Torque" shopName="Taller Ejemplo" />);

    const byline = screen.getByText("by Torque");
    expect(byline).toHaveClass("text-xs", "text-muted-foreground");
    expect(byline.previousElementSibling).toHaveTextContent("Taller Ejemplo");
  });

  it("shows no byline without a shop, where the app's name is already the title", () => {
    render(<TopBar appName="Torque" byline="by Torque" />);

    expect(screen.queryByText("by Torque")).toBeNull();
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

  it("makes the logo and the name one link to Inicio", () => {
    const { container } = render(<TopBar appName="Torque" byline="by Torque" shopName="Taller Ejemplo" />);

    const link = screen.getByRole("link", { name: /Taller Ejemplo/ });
    expect(link).toHaveAttribute("href", "/inicio");
    expect(link).toContainElement(container.querySelector('[data-slot="logo-mark"]'));
    expect(link).toContainElement(screen.getByText("by Torque"));
  });

  it("renders actions on the right", () => {
    render(<TopBar appName="Torque" actions={<button type="button">Cerrar sesión</button>} />);
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});
