import { describe, expect, it } from "vitest";

import { splitTypedClient } from "./new-client";

describe("splitTypedClient", () => {
  it("puts the first word in Nombre and the rest in Apellido", () => {
    expect(splitTypedClient("Ana")).toEqual({ name: "Ana", surname: "", phoneNumber: "" });
    expect(splitTypedClient("Ana Gómez")).toEqual({ name: "Ana", surname: "Gómez", phoneNumber: "" });
    expect(splitTypedClient("  ana   de   la  cruz ")).toEqual({ name: "ana", surname: "de la cruz", phoneNumber: "" });
  });

  it("puts a number in Teléfono, formatted like the field would", () => {
    expect(splitTypedClient("1112345678")).toEqual({ name: "", surname: "", phoneNumber: "11 1234-5678" });
    expect(splitTypedClient("11 1234-5678")).toEqual({ name: "", surname: "", phoneNumber: "11 1234-5678" });
    expect(splitTypedClient("(011) 4444-5555")).toEqual({ name: "", surname: "", phoneNumber: "11 4444-5555" });
  });

  it("keeps a partial number as digits", () => {
    expect(splitTypedClient("11 12").phoneNumber).toBe("11 12");
  });

  it("carries nothing when nothing was typed", () => {
    expect(splitTypedClient("")).toEqual({ name: "", surname: "", phoneNumber: "" });
    expect(splitTypedClient("   ")).toEqual({ name: "", surname: "", phoneNumber: "" });
  });

  it("treats a name with digits as a name", () => {
    expect(splitTypedClient("Taller 24")).toEqual({ name: "Taller", surname: "24", phoneNumber: "" });
  });
});
