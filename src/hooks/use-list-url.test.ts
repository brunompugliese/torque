import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ListSearchProvider } from "@/components/shared/list-search-provider";

const replace = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
let currentSearch = "";

vi.mock("next/navigation", () => ({
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
    expect(replace).toHaveBeenCalledWith(null, "", "/servicios?buscar=alin");
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
    expect(replace).toHaveBeenCalledWith(null, "", "/servicios?archivados=1");
  });

  it("toggles archived and sort back to page 1, keeping the rest", () => {
    currentSearch = "buscar=aceite&pagina=4";
    const { result } = renderHook(() => useListUrl());

    act(() => result.current.setShowArchived(true));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?buscar=aceite&archivados=1");

    act(() => result.current.toggleSort("nombre"));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?buscar=aceite&orden=nombre");
  });

  it("flips the current column and starts another column ascending", () => {
    currentSearch = "orden=nombre&sentido=desc";
    const { result, rerender } = renderHook(() => useListUrl());
    act(() => result.current.toggleSort("nombre"));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?orden=nombre");

    act(() => result.current.toggleSort("creado"));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?orden=creado");

    currentSearch = "orden=creado";
    rerender();
    act(() => result.current.toggleSort("creado"));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?orden=creado&sentido=desc");
  });

  it("changes page keeping the filters", () => {
    currentSearch = "sentido=desc";
    const { result } = renderHook(() => useListUrl());
    act(() => result.current.setPage(2));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?sentido=desc&pagina=2");
    act(() => result.current.setPage(1));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?sentido=desc");
  });
});

// The search stays in state: it never reaches the address bar.
describe("useListUrl inside a ListSearchProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(ListSearchProvider, null, children);

  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockReset();
    currentSearch = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with no search and ignores one in the URL", () => {
    currentSearch = "buscar=ae482&pagina=2";
    const { result } = renderHook(() => useListUrl(), { wrapper });
    expect(result.current.params.search).toBe("");
    expect(result.current.searchValue).toBe("");
    expect(result.current.params.page).toBe(2);
  });

  it("debounces the search into state, back to page 1, and keeps it out of the URL", () => {
    currentSearch = "pagina=3&archivados=1";
    const { result } = renderHook(() => useListUrl(), { wrapper });

    act(() => result.current.setSearchValue("ae"));
    act(() => result.current.setSearchValue("ae482"));
    expect(result.current.searchValue).toBe("ae482");
    expect(result.current.params.search).toBe("");
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current.params.search).toBe("ae482");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(null, "", "/servicios?archivados=1");
  });

  it("doesn't commit when the trimmed search didn't change", () => {
    const { result } = renderHook(() => useListUrl(), { wrapper });
    act(() => result.current.setSearchValue("ae482"));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    replace.mockClear();

    act(() => result.current.setSearchValue("ae482 "));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the search out of the URL when sorting, paging or switching archived", () => {
    const { result } = renderHook(() => useListUrl(), { wrapper });
    act(() => result.current.setSearchValue("ae482"));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    act(() => result.current.toggleSort("patente"));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?orden=patente");
    act(() => result.current.setPage(2));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?pagina=2");
    act(() => result.current.setShowArchived(true));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/servicios?archivados=1");
    expect(result.current.params.search).toBe("ae482");
  });

  it("clears the search right away", () => {
    const { result } = renderHook(() => useListUrl(), { wrapper });
    act(() => result.current.setSearchValue("ae482"));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    act(() => result.current.clearSearch());
    expect(result.current.searchValue).toBe("");
    expect(result.current.params.search).toBe("");
  });

  it("shares the search between the components that use the hook", () => {
    const { result } = renderHook(() => ({ toolbar: useListUrl(), table: useListUrl() }), { wrapper });
    act(() => result.current.toolbar.setSearchValue("ae482"));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current.table.params.search).toBe("ae482");
    expect(result.current.table.searchValue).toBe("ae482");

    act(() => result.current.table.clearSearch());
    expect(result.current.toolbar.searchValue).toBe("");
    expect(result.current.toolbar.params.search).toBe("");
  });
});
