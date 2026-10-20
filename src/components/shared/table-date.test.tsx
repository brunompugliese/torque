import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { TableDate } from "./table-date";

describe("TableDate", () => {
  it("shows dd/mm/aaaa in Argentina time, in secondary text", () => {
    renderWithIntl(<TableDate value="2026-10-14T01:30:00Z" />);
    expect(screen.getByText("13/10/2026")).toHaveClass("text-muted-foreground", "whitespace-nowrap");
  });
});
