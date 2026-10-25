import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ListSearchProvider, useListSearch } from "./list-search-provider";

describe("ListSearchProvider", () => {
  it("is absent by default: pages without it keep their search in the URL", () => {
    const { result } = renderHook(() => useListSearch());
    expect(result.current).toBeNull();
  });

  it("starts empty and holds the typed value and the committed search apart", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <ListSearchProvider>{children}</ListSearchProvider>;
    const { result } = renderHook(() => useListSearch(), { wrapper });
    expect(result.current).toMatchObject({ search: "", searchValue: "" });

    act(() => result.current?.setSearchValue("ae 482"));
    expect(result.current).toMatchObject({ search: "", searchValue: "ae 482" });

    act(() => result.current?.setSearch("ae 482"));
    expect(result.current).toMatchObject({ search: "ae 482", searchValue: "ae 482" });
  });
});
