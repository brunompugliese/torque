import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useListResults } from "./use-list-results";

type Props = { initial: string; initialKey: string; key: string };

function setup(fetchResults: (key: string) => Promise<string>, props: Props) {
  return renderHook((p: Props) => useListResults(p.initial, p.initialKey, p.key, fetchResults), {
    initialProps: props,
  });
}

describe("useListResults", () => {
  it("uses the server results without fetching while the key matches", () => {
    const fetchResults = vi.fn();
    const { result } = setup(fetchResults, { initial: "server", initialKey: "", key: "" });
    expect(result.current.result).toBe("server");
    expect(fetchResults).not.toHaveBeenCalled();
  });

  it("fetches only the results when the key changes", async () => {
    const fetchResults = vi.fn(async (key: string) => `rows for ${key}`);
    const { result, rerender } = setup(fetchResults, { initial: "server", initialKey: "", key: "" });

    rerender({ initial: "server", initialKey: "", key: "buscar=ace" });
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.result).toBe("rows for buscar=ace"));
    expect(result.current.pending).toBe(false);
    expect(fetchResults).toHaveBeenCalledTimes(1);
  });

  it("drops an answer that arrives after a newer request", async () => {
    let resolveSlow: (value: string) => void = () => {};
    const fetchResults = vi.fn((key: string) =>
      key === "slow" ? new Promise<string>((resolve) => (resolveSlow = resolve)) : Promise.resolve(`rows for ${key}`),
    );
    const { result, rerender } = setup(fetchResults, { initial: "server", initialKey: "", key: "" });

    rerender({ initial: "server", initialKey: "", key: "slow" });
    rerender({ initial: "server", initialKey: "", key: "fast" });
    await waitFor(() => expect(result.current.result).toBe("rows for fast"));

    await act(async () => resolveSlow("rows for slow"));
    expect(result.current.result).toBe("rows for fast");
  });

  it("adopts new server results", () => {
    const fetchResults = vi.fn();
    const { result, rerender } = setup(fetchResults, { initial: "server", initialKey: "", key: "" });
    rerender({ initial: "refreshed", initialKey: "", key: "" });
    expect(result.current.result).toBe("refreshed");
    expect(fetchResults).not.toHaveBeenCalled();
  });

  it("retries the current key", async () => {
    const fetchResults = vi.fn(async () => "again");
    const { result } = setup(fetchResults, { initial: "error", initialKey: "", key: "" });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.result).toBe("again"));
    expect(fetchResults).toHaveBeenCalledWith("");
  });
});
