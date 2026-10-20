import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useLoadedData } from "./use-loaded-data";

function setup(load: () => Promise<string>, key = "a") {
  return renderHook((props: { key: string }) => useLoadedData(props.key, load), { initialProps: { key } });
}

describe("useLoadedData", () => {
  it("starts loading and then has the data", async () => {
    const { result } = setup(async () => "rows");
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current).toMatchObject({ status: "ready", data: "rows" });
  });

  it("is an error when the load rejects, and retry loads again", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("rows");
    const { result } = setup(load);

    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current).toMatchObject({ status: "ready", data: "rows" }));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("hands over the last data that loaded while it reloads", async () => {
    const load = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const { result } = setup(load);
    expect(result.current).toMatchObject({ status: "loading", previous: undefined });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.retry());
    expect(result.current).toMatchObject({ status: "loading", previous: "first" });
    await waitFor(() => expect(result.current).toMatchObject({ status: "ready", data: "second" }));
  });

  it("loads again, from the loading state, when the key changes", async () => {
    const load = vi.fn(async () => "rows");
    const { result, rerender } = setup(load);
    await waitFor(() => expect(result.current.status).toBe("ready"));

    rerender({ key: "b" });
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("drops an answer that arrives after a newer request", async () => {
    let resolveSlow: (value: string) => void = () => {};
    const load = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce("fast");
    const { result, rerender } = setup(load, "slow");

    rerender({ key: "fast" });
    await waitFor(() => expect(result.current).toMatchObject({ status: "ready", data: "fast" }));

    await act(async () => resolveSlow("slow"));
    expect(result.current).toMatchObject({ status: "ready", data: "fast" });
  });
});
