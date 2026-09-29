import { CarIcon, HouseIcon, UsersIcon } from "@phosphor-icons/react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FloatingNav, type FloatingNavItem } from "./floating-nav";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

const ITEMS: FloatingNavItem[] = [
  { href: "/", label: "Inicio", icon: HouseIcon },
  { href: "/vehiculos", label: "Vehículos", icon: CarIcon },
  { href: "/clientes", label: "Clientes", icon: UsersIcon },
];

function renderNav() {
  render(<FloatingNav items={ITEMS} ariaLabel="Navegación principal" />);
}

describe("FloatingNav", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  it("renders a navigation landmark with the given name", () => {
    renderNav();
    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
  });

  it("renders each item as a link named by its visible label", () => {
    renderNav();
    for (const item of ITEMS) {
      const link = screen.getByRole("link", { name: item.label });
      expect(link).toHaveAttribute("href", item.href);
      expect(link).toHaveTextContent(item.label);
    }
  });

  it("hides icons from assistive technology", () => {
    renderNav();
    for (const svg of document.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it.each([
    ["/", "Inicio"],
    ["/vehiculos", "Vehículos"],
    ["/vehiculos/123", "Vehículos"],
    ["/clientes", "Clientes"],
  ])("on %s marks only %s as the current page", (path, label) => {
    pathname.current = path;
    renderNav();

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(label);
  });

  it("marks nothing as current on an unknown path", () => {
    pathname.current = "/ajustes";
    renderNav();
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});
