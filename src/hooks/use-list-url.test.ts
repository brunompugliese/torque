import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/servicios",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { SEARCH_DEBOUNCE_MS, useListUrl } from "./use-list-url";

describe("useListUrl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockReset();
    currentSearch = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses the current URL", () => {
    currentSearch = "buscar=aceite&archivados=1&orden=creado&sentido=desc&pagina=2";
    const { result } = renderHook(() => useListUrl());
    expect(result.current.params).toEqual({
      search: "aceite",
      showArchived: true,
      sortBy: "creado",
      sort: "desc",
      page: 2,
    });
    expect(result.current.searchValue).toBe("aceite");
  });

  it("debounces the search and resets to page 1", () => {
    currentSearch = "pagina=3";
    const { result } = renderHook(() => useListUrl());

    act(() => result.current.setSearchValue("ali"));
    act(() => result.current.setSearchValue("alin"));
    expect(result.current.searchValue).toBe("alin");
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/servicios?buscar=alin", { scroll: false });
  });

  it("doesn't navigate when the trimmed search didn't change", () => {
    currentSearch = "buscar=aceite";
    const { result } = renderHook(() => useListUrl());
    act(() => result.current.setSearchValue("aceite "));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(replace).not.toHaveBeenCalled();
  });

  it("clears the search right away", () => {
    currentSearch = "buscar=aceite&archivados=1";
    const { result } = renderHook(() => useListUrl());
    act(() => result.current.clearSearch());
    expect(result.current.searchValue).toBe("");
    expect(replace).toHaveBeenCalledWith("/servicios?archivados=1", { scroll: false });
  });

  it("toggles archived and sort back to page 1, keeping the rest", () => {
    currentSearch = "buscar=aceite&pagina=4";
    const { result } = renderHook(() => useListUrl());

    act(() => result.current.setShowArchived(true));
    expect(replace).toHaveBeenLastCalledWith("/servicios?buscar=aceite&archivados=1", { scroll: false });

    act(() => result.current.toggleSort("nombre", "nombre"));
    expect(replace).toHaveBeenLastCalledWith("/servicios?buscar=aceite&sentido=desc", { scroll: false });
  });

  it("flips the current column and starts another column ascending", () => {
    currentSearch = "sentido=desc";
    const { result, rerender } = renderHook(() => useListUrl());
    act(() => result.current.toggleSort("nombre", "nombre"));
    expect(replace).toHaveBeenLastCalledWith("/servicios", { scroll: false });

    act(() => result.current.toggleSort("creado", "nombre"));
    expect(replace).toHaveBeenLastCalledWith("/servicios?orden=creado", { scroll: false });

    currentSearch = "orden=creado";
    rerender();
    act(() => result.current.toggleSort("creado", "nombre"));
    expect(replace).toHaveBeenLastCalledWith("/servicios?orden=creado&sentido=desc", { scroll: false });
  });

  it("changes page keeping the filters", () => {
    currentSearch = "sentido=desc";
    const { result } = renderHook(() => useListUrl());
    act(() => result.current.setPage(2));
    expect(replace).toHaveBeenLastCalledWith("/servicios?sentido=desc&pagina=2", { scroll: false });
    act(() => result.current.setPage(1));
    expect(replace).toHaveBeenLastCalledWith("/servicios?sentido=desc", { scroll: false });
  });
});
