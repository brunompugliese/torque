import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REMOTE_SEARCH_DEBOUNCE_MS, useRemoteOptions } from "./use-remote-options";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const settle = () => act(async () => vi.advanceTimersByTime(REMOTE_SEARCH_DEBOUNCE_MS));

describe("useRemoteOptions", () => {
  it("is loading until the first answer, then lists its rows", async () => {
    const search = vi.fn(async (term: string) => [`match ${term}`]);
    const { result } = renderHook(() => useRemoteOptions("ana", search));
    expect(result.current).toEqual({ rows: [], loading: true });
    expect(search).not.toHaveBeenCalled();

    await settle();
    expect(search).toHaveBeenCalledWith("ana");
    expect(result.current).toEqual({ rows: ["match ana"], loading: false });
  });

  it("waits for the typing to pause: only the last term is searched", async () => {
    const search = vi.fn(async (term: string) => [term]);
    const { result, rerender } = renderHook(({ term }) => useRemoteOptions(term, search), {
      initialProps: { term: "a" },
    });
    rerender({ term: "an" });
    rerender({ term: "ana" });
    await settle();
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("ana");
    expect(result.current.rows).toEqual(["ana"]);
  });

  it("is loading again for a new term while it keeps showing the last rows", async () => {
    const search = vi.fn(async (term: string) => [term]);
    const { result, rerender } = renderHook(({ term }) => useRemoteOptions(term, search), {
      initialProps: { term: "a" },
    });
    await settle();
    rerender({ term: "ab" });
    expect(result.current).toEqual({ rows: ["a"], loading: true });
    await settle();
    expect(result.current).toEqual({ rows: ["ab"], loading: false });
  });

  it("drops an answer that arrives after a newer search", async () => {
    const resolvers: Record<string, (rows: string[]) => void> = {};
    const search = vi.fn((term: string) => new Promise<string[]>((resolve) => (resolvers[term] = resolve)));
    const { result, rerender } = renderHook(({ term }) => useRemoteOptions(term, search), {
      initialProps: { term: "a" },
    });
    await settle();
    rerender({ term: "ab" });
    await settle();

    await act(async () => resolvers.ab(["new"]));
    await act(async () => resolvers.a(["old"]));
    expect(result.current).toEqual({ rows: ["new"], loading: false });
  });

  it("treats a failed search as no options, not as loading forever", async () => {
    const { result } = renderHook(() => useRemoteOptions("ana", async () => null));
    await settle();
    expect(result.current).toEqual({ rows: [], loading: false });

    const rejecting = renderHook(() =>
      useRemoteOptions("ana", async () => {
        throw new Error("network");
      }),
    );
    await settle();
    expect(rejecting.result.current).toEqual({ rows: [], loading: false });
  });

  it("does nothing while disabled", async () => {
    const search = vi.fn(async () => ["x"]);
    const { result } = renderHook(() => useRemoteOptions("ana", search, { enabled: false }));
    await settle();
    expect(search).not.toHaveBeenCalled();
    expect(result.current).toEqual({ rows: [], loading: false });
  });
});
