import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { fail, ok } from "@/lib/actions/result";

import { useArchiveFlow } from "./use-archive-flow";

type Record = { name: string };

function setup(run: (archived: boolean) => Promise<ReturnType<typeof ok<Record>> | ReturnType<typeof fail>>) {
  const onDone = vi.fn();
  const notify = vi.fn((archived: boolean, data: Record) => ({
    title: archived ? "Cliente archivado" : "Cliente desarchivado",
    description: data.name,
  }));
  const hook = renderHook(() => useArchiveFlow<Record>({ run, notify, onDone, errorMessage: "Algo salió mal." }));
  return { ...hook, onDone, notify };
}

beforeEach(() => {
  toastMock.mockReset();
  toastMock.error.mockReset();
});

describe("useArchiveFlow", () => {
  it("asks first: the confirmation opens and nothing runs until it is confirmed", () => {
    const run = vi.fn(async () => ok({ name: "Ana" }));
    const { result } = setup(run);
    expect(result.current.confirmOpen).toBe(false);

    act(() => result.current.askToArchive());
    expect(result.current.confirmOpen).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it("archives after the confirmation: runs, closes the confirmation, toasts and closes the modal", async () => {
    const run = vi.fn(async () => ok({ name: "Ana" }));
    const { result, onDone } = setup(run);

    act(() => result.current.askToArchive());
    await act(async () => result.current.archive());

    expect(run).toHaveBeenCalledWith(true);
    expect(result.current.confirmOpen).toBe(false);
    expect(toastMock).toHaveBeenCalledWith("Cliente archivado", { description: "Ana" });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("unarchives right away, without a confirmation", async () => {
    const run = vi.fn(async () => ok({ name: "Ana" }));
    const { result, onDone } = setup(run);

    await act(async () => result.current.unarchive());

    expect(result.current.confirmOpen).toBe(false);
    expect(run).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith("Cliente desarchivado", { description: "Ana" });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("on failure keeps the modal open and shows only the error toast", async () => {
    const { result, onDone } = setup(async () => fail("unexpected"));

    act(() => result.current.askToArchive());
    await act(async () => result.current.archive());

    expect(toastMock.error).toHaveBeenCalledWith("Algo salió mal.");
    expect(toastMock).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(false);
  });

  it("is pending while the action runs", async () => {
    let finish: (value: ReturnType<typeof ok<Record>>) => void = () => {};
    const { result } = setup(() => new Promise((resolve) => (finish = resolve)));

    act(() => result.current.unarchive());
    expect(result.current.pending).toBe(true);

    await act(async () => finish(ok({ name: "Ana" })));
    expect(result.current.pending).toBe(false);
  });

  it("passes what the action returned to the toast", async () => {
    const { result, notify } = setup(async () => ok({ name: "Zoe" }));
    await act(async () => result.current.archive());
    expect(notify).toHaveBeenCalledWith(true, { name: "Zoe" });
  });
});
