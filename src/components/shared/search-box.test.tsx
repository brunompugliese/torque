import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { SearchBox } from "./search-box";

describe("SearchBox", () => {
  it("is a labelled search field with a placeholder and the given value", () => {
    renderWithIntl(<SearchBox value="ace" onChange={() => {}} placeholder="Buscar por patente" />);
    const search = screen.getByRole("searchbox", { name: "Buscar" });
    expect(search).toHaveValue("ace");
    expect(search).toHaveAttribute("placeholder", "Buscar por patente");
  });

  it("reports what is typed", () => {
    const onChange = vi.fn();
    renderWithIntl(<SearchBox value="" onChange={onChange} placeholder="Buscar" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ab 123" } });
    expect(onChange).toHaveBeenCalledWith("ab 123");
  });
});
