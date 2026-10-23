import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { FilterPopover } from "./filter-popover";

describe("FilterPopover", () => {
  it("shows its label on a button and hides the panel until opened", () => {
    renderWithIntl(
      <FilterPopover label="Estado">
        <p>Contenido del filtro</p>
      </FilterPopover>,
    );
    expect(screen.getByRole("button", { name: "Estado" })).toBeInTheDocument();
    expect(screen.queryByText("Contenido del filtro")).toBeNull();
  });

  it("opens the panel with the filter's controls", async () => {
    renderWithIntl(
      <FilterPopover label="Estado">
        <p>Contenido del filtro</p>
      </FilterPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Estado" }));
    expect(await screen.findByText("Contenido del filtro")).toBeInTheDocument();
  });

  it("shows how many choices are applied", () => {
    renderWithIntl(
      <FilterPopover label="Estado" active count={2}>
        <p>x</p>
      </FilterPopover>,
    );
    const button = screen.getByRole("button", { name: /Estado/ });
    expect(button).toHaveTextContent("· 2");
    expect(button).toHaveAttribute("data-active", "true");
  });

  it("is not marked active by default", () => {
    renderWithIntl(
      <FilterPopover label="Fecha">
        <p>x</p>
      </FilterPopover>,
    );
    expect(screen.getByRole("button", { name: "Fecha" })).not.toHaveAttribute("data-active");
  });

  describe("Limpiar", () => {
    async function open(props: { active?: boolean; onClear?: () => void }) {
      renderWithIntl(
        <FilterPopover label="Estado" count={props.active ? 2 : undefined} {...props}>
          <p>Contenido</p>
        </FilterPopover>,
      );
      fireEvent.click(screen.getByRole("button", { name: /^Estado/ }));
      await screen.findByText("Contenido");
    }

    it("shows while the filter is active, naming the filter, and clears it", async () => {
      const onClear = vi.fn();
      await open({ active: true, onClear });
      const clear = screen.getByRole("button", { name: "Limpiar filtro: Estado" });
      expect(clear).toHaveTextContent("Limpiar");
      fireEvent.click(clear);
      expect(onClear).toHaveBeenCalledOnce();
    });

    it("is not there when the filter is not active", async () => {
      await open({ active: false, onClear: vi.fn() });
      expect(screen.queryByRole("button", { name: /Limpiar/ })).toBeNull();
    });

    it("is not there when the page gave no way to clear", async () => {
      await open({ active: true });
      expect(screen.queryByRole("button", { name: /Limpiar/ })).toBeNull();
    });
  });
});
