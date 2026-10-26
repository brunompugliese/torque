import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { ListToolbar, ListToolbarSkeleton } from "./list-toolbar";
import { TextSkeleton } from "./text-skeleton";

function renderToolbar(props: Partial<Parameters<typeof ListToolbar>[0]> = {}) {
  const handlers = { onSearchChange: vi.fn(), onShowArchivedChange: vi.fn() };
  renderWithIntl(
    <ListToolbar
      searchValue="ace"
      searchPlaceholder="Buscar por nombre"
      showArchived={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("ListToolbar", () => {
  it("shows the search with its placeholder and reports typing", () => {
    const { onSearchChange } = renderToolbar();
    const search = screen.getByRole("searchbox", { name: "Buscar" });
    expect(search).toHaveValue("ace");
    expect(search).toHaveAttribute("placeholder", "Buscar por nombre");
    fireEvent.change(search, { target: { value: "acei" } });
    expect(onSearchChange).toHaveBeenCalledWith("acei");
  });

  it("draws no archived switch when the page gives no handler", () => {
    renderToolbar({ onShowArchivedChange: undefined });
    expect(screen.queryByRole("switch", { name: "Mostrar archivados" })).toBeNull();
  });

  it("toggles Mostrar archivados", () => {
    const { onShowArchivedChange } = renderToolbar();
    const toggle = screen.getByRole("switch", { name: "Mostrar archivados" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onShowArchivedChange).toHaveBeenCalledWith(true);
  });

  it("renders page-specific filters", () => {
    renderToolbar({ filters: <button type="button">Estado</button> });
    expect(screen.getByRole("button", { name: "Estado" })).toBeInTheDocument();
  });
});

describe("toolbar skeletons", () => {
  it.each([
    ["ListToolbarSkeleton", <ListToolbarSkeleton key="t" />],
    ["TextSkeleton", <TextSkeleton key="c" />],
  ])("%s is a busy region announced once", (_name, element) => {
    const { container } = renderWithIntl(element);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
