import { describe, expect, it, vi } from "vitest";

import { existsWhere, findByKey, LookupError } from "./lookups";

type Result = { data: unknown; error: { code: string } | null };

// Records every builder call and resolves with `result` when awaited.
function fakeClient(result: Result) {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "limit"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: Result) => unknown) => resolve(result);
  const from = vi.fn((table: string) => {
    calls.push(["from", table]);
    return builder;
  });
  return { client: { from } as never, calls };
}

describe("findByKey", () => {
  it("looks up one row by key, excluding the record being edited", async () => {
    const { client, calls } = fakeClient({ data: { id: "s1", enabled: false }, error: null });
    const match = await findByKey(client, { table: "service", column: "name_key", key: "aceite", excludeId: "s2" });

    expect(match).toEqual({ id: "s1", enabled: false });
    expect(calls).toEqual([
      ["from", "service"],
      ["select", "id, enabled"],
      ["eq", "name_key", "aceite"],
      ["neq", "id", "s2"],
      ["limit", 1],
    ]);
  });

  it("returns null when nothing matches and doesn't exclude without an id", async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    expect(await findByKey(client, { table: "service", column: "name_key", key: "x" })).toBeNull();
    expect(calls.some(([method]) => method === "neq")).toBe(false);
  });

  it("throws a LookupError with the code on failure", async () => {
    const { client } = fakeClient({ data: null, error: { code: "42501" } });
    await expect(findByKey(client, { table: "service", column: "name_key", key: "x" })).rejects.toEqual(
      new LookupError("42501"),
    );
  });
});

describe("existsWhere", () => {
  it("is true when a row exists, asking for one row only", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "i1" }], error: null });
    expect(await existsWhere(client, { table: "job_item", column: "service_id", value: "s1" })).toBe(true);
    expect(calls).toContainEqual(["limit", 1]);
  });

  it("is false when there are none", async () => {
    const { client } = fakeClient({ data: [], error: null });
    expect(await existsWhere(client, { table: "job_item", column: "service_id", value: "s1" })).toBe(false);
  });

  it("throws on failure", async () => {
    const { client } = fakeClient({ data: null, error: { code: "500" } });
    await expect(existsWhere(client, { table: "job_item", column: "service_id", value: "s1" })).rejects.toBeInstanceOf(
      LookupError,
    );
  });
});
