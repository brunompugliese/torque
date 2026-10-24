import { vi } from "vitest";

export type FakeCall = [method: string, ...args: unknown[]];

export type FakeQuery = {
  table: string;
  calls: FakeCall[];
  operation: string;
};

export type FakeResult = {
  data?: unknown;
  error?: { code: string; message?: string } | null;
  count?: number | null;
};

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "eq",
  "neq",
  "in",
  "is",
  "not",
  "lt",
  "gt",
  "gte",
  "lte",
  "like",
  "or",
  "order",
  "range",
  "limit",
] as const;

// Records each query's calls and resolves it with respond(query). A database
// function (rpc) is recorded as a query on the table named after it, with the
// operation "rpc".
export function createFakeSupabase(respond: (query: FakeQuery) => FakeResult) {
  const queries: FakeQuery[] = [];

  function from(table: string) {
    const query: FakeQuery = { table, calls: [], operation: "" };
    queries.push(query);
    const resolve = () => {
      const result = respond(query);
      return Promise.resolve({ data: null, error: null, count: null, ...result });
    };

    const builder: Record<string, unknown> = {};
    for (const method of CHAIN_METHODS) {
      builder[method] = vi.fn((...args: unknown[]) => {
        if (!query.operation) query.operation = method;
        query.calls.push([method, ...args]);
        return builder;
      });
    }
    builder.single = vi.fn(() => resolve());
    builder.maybeSingle = vi.fn(() => resolve());
    builder.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      resolve().then(onFulfilled, onRejected);
    return builder;
  }

  function rpc(name: string, args: unknown) {
    const query: FakeQuery = { table: name, calls: [["rpc", name, args]], operation: "rpc" };
    queries.push(query);
    return Promise.resolve({ data: null, error: null, count: null, ...respond(query) });
  }

  return { supabase: { from: vi.fn(from), rpc: vi.fn(rpc) }, queries };
}

export function filterValue(query: FakeQuery, method: string, column: string): unknown {
  return query.calls.find(([name, col]) => name === method && col === column)?.[2];
}
