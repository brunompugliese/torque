import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.spyOn(window.history, "replaceState").mockImplementation((...args) => nav.replace(...args));

vi.mock("next/navigation", () => ({
  usePathname: () => "/algo",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { ListUrlToolbar } from "./list-url-toolbar";

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
});

describe("ListUrlToolbar", () => {
  it("shows the given placeholder and has only the search and the archived switch", () => {
    renderWithIntl(<ListUrlToolbar searchPlaceholder="Buscar por algo" />);
    expect(screen.getByRole("searchbox", { name: "Buscar" })).toHaveAttribute("placeholder", "Buscar por algo");
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  it("starts from the URL state", () => {
    nav.search = "buscar=aceite&archivados=1";
    renderWithIntl(<ListUrlToolbar searchPlaceholder="Buscar por algo" />);
    expect(screen.getByRole("searchbox")).toHaveValue("aceite");
    expect(screen.getByRole("switch", { name: "Mostrar archivados" })).toBeChecked();
  });

  it("writes the search (debounced) and the switch to the URL", async () => {
    vi.useFakeTimers();
    try {
      renderWithIntl(<ListUrlToolbar searchPlaceholder="Buscar por algo" />);
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "aceite" } });
      expect(nav.replace).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(300));
      expect(nav.replace).toHaveBeenCalledWith(null, "", "/algo?buscar=aceite");

      fireEvent.click(screen.getByRole("switch", { name: "Mostrar archivados" }));
      expect(nav.replace).toHaveBeenLastCalledWith(null, "", "/algo?archivados=1");
    } finally {
      vi.useRealTimers();
    }
  });
});
