import { describe, expect, it } from "vitest";

import { DEFAULT_LIST_PARAMS, parseListParams, resolveSortBy, toListSearch } from "./params";

describe("parseListParams", () => {
  it("returns the defaults for an empty URL", () => {
    expect(parseListParams({})).toEqual(DEFAULT_LIST_PARAMS);
  });

  it("reads every param from a record or URLSearchParams", () => {
    const expected = { search: "aceite", showArchived: true, sortBy: "creado", sort: "desc", page: 3, filters: {} };
    expect(
      parseListParams({ buscar: " aceite ", archivados: "1", orden: "creado", sentido: "desc", pagina: "3" }),
    ).toEqual(expected);
    expect(
      parseListParams(new URLSearchParams("buscar=aceite&archivados=1&orden=creado&sentido=desc&pagina=3")),
    ).toEqual(expected);
  });

  it("takes the first value of a repeated param", () => {
    expect(parseListParams({ buscar: ["uno", "dos"] }).search).toBe("uno");
  });

  it.each([["0"], ["-2"], ["1.5"], ["abc"], [""]])("ignores page %j", (pagina) => {
    expect(parseListParams({ pagina }).page).toBe(1);
  });

  it("ignores unknown values for sort and archived", () => {
    expect(parseListParams({ sentido: "random", archivados: "true" })).toMatchObject({
      sort: "asc",
      showArchived: false,
    });
  });

  it.each([["Creado"], ["name_key; drop"], ["1"]])("ignores sort column %j", (orden) => {
    expect(parseListParams({ orden }).sortBy).toBe("");
  });
});

describe("parseListParams filters", () => {
  it("reads only the whitelisted keys", () => {
    const raw = { estado: "entregado,cancelado", desde: "2026-09-01", otro: "x" };
    expect(parseListParams(raw, ["estado", "desde", "hasta"]).filters).toEqual({
      estado: "entregado,cancelado",
      desde: "2026-09-01",
    });
    expect(parseListParams(raw).filters).toEqual({});
  });

  it.each([["Entregado"], ["a b"], ["x;drop"], ["<script>"], [""]])("drops the value %j", (estado) => {
    expect(parseListParams({ estado }, ["estado"]).filters).toEqual({});
  });
});

describe("toListSearch", () => {
  it("leaves defaults out of the URL", () => {
    expect(toListSearch(DEFAULT_LIST_PARAMS)).toBe("");
  });

  it("writes the filters in a stable order and round-trips them", () => {
    const params = { ...DEFAULT_LIST_PARAMS, filters: { hasta: "2026-09-30", estado: "entregado" } };
    expect(toListSearch(params)).toBe("estado=entregado&hasta=2026-09-30");
    expect(parseListParams(new URLSearchParams(toListSearch(params)), ["estado", "hasta"])).toEqual(params);
  });

  it("round-trips through parseListParams", () => {
    const params = {
      search: "cambio de aceite",
      showArchived: true,
      sortBy: "creado",
      sort: "desc" as const,
      page: 2,
      filters: {},
    };
    expect(parseListParams(new URLSearchParams(toListSearch(params)))).toEqual(params);
  });
});

describe("resolveSortBy", () => {
  it("keeps a known column and falls back to the default otherwise", () => {
    expect(resolveSortBy("creado", ["nombre", "creado"], "nombre")).toBe("creado");
    expect(resolveSortBy("", ["nombre", "creado"], "nombre")).toBe("nombre");
    expect(resolveSortBy("otro", ["nombre", "creado"], "nombre")).toBe("nombre");
  });
});
