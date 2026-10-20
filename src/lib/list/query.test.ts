import { describe, expect, it } from "vitest";

import { DEFAULT_LIST_PARAMS } from "./params";
import { applyListQuery, type ListQueryBuilder } from "./query";

class FakeQuery implements ListQueryBuilder<FakeQuery> {
  calls: unknown[][] = [];
  like(column: string, pattern: string) {
    this.calls.push(["like", column, pattern]);
    return this;
  }
  eq(column: string, value: boolean) {
    this.calls.push(["eq", column, value]);
    return this;
  }
  order(column: string, options: { ascending: boolean }) {
    this.calls.push(["order", column, options.ascending]);
    return this;
  }
  range(from: number, to: number) {
    this.calls.push(["range", from, to]);
    return this;
  }
}

const OPTIONS = {
  searchColumn: "search_text",
  sortColumns: { nombre: "name_key", creado: "created_at" },
  defaultSortBy: "nombre",
};

function run(params: Partial<typeof DEFAULT_LIST_PARAMS>) {
  return applyListQuery(new FakeQuery(), { ...DEFAULT_LIST_PARAMS, ...params }, OPTIONS).calls;
}

describe("applyListQuery", () => {
  it("shows only active rows, A–Z, first page by default", () => {
    expect(run({})).toEqual([
      ["eq", "enabled", true],
      ["order", "name_key", true],
      ["order", "id", true],
      ["range", 0, 24],
    ]);
  });

  it("includes archived rows when the switch is on", () => {
    expect(run({ showArchived: true })).not.toContainEqual(["eq", "enabled", true]);
  });

  it("searches the normalized column and always includes archived rows", () => {
    const calls = run({ search: "Alineación" });
    expect(calls).toContainEqual(["like", "search_text", "%alineacion%"]);
    expect(calls).not.toContainEqual(["eq", "enabled", true]);
  });

  it("treats a punctuation-only search as no search", () => {
    expect(run({ search: " - " })).toContainEqual(["eq", "enabled", true]);
  });

  it("sorts by the chosen column, and by the default for unknown ones", () => {
    expect(run({ sortBy: "creado" })).toContainEqual(["order", "created_at", true]);
    expect(run({ sortBy: "otro" })).toContainEqual(["order", "name_key", true]);
  });

  it("sorts Z–A and pages", () => {
    const calls = run({ sort: "desc", page: 3 });
    expect(calls).toContainEqual(["order", "name_key", false]);
    expect(calls).toContainEqual(["order", "id", false]);
    expect(calls).toContainEqual(["range", 50, 74]);
  });
});
