import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FIELD_WIDTH, FormRow } from "./form-layout";

describe("FormRow", () => {
  it("puts its fields two to a row from sm up and stacks them below", () => {
    render(
      <FormRow>
        <div>Nombre</div>
        <div>Apellido</div>
      </FormRow>,
    );
    const row = screen.getByText("Nombre").parentElement!;
    expect(row).toHaveClass("grid", "sm:grid-cols-2");
    expect(row).not.toHaveClass("grid-cols-2");
    expect(row).toContainElement(screen.getByText("Apellido"));
  });

  it("accepts extra classes", () => {
    render(
      <FormRow className="items-start">
        <div>Nombre</div>
      </FormRow>,
    );
    expect(screen.getByText("Nombre").parentElement).toHaveClass("items-start", "grid");
  });
});

describe("FIELD_WIDTH", () => {
  it("limits a short field only from sm up, so it stacks full width on a small screen", () => {
    for (const width of Object.values(FIELD_WIDTH)) expect(width).toMatch(/^sm:max-w-/);
  });

  it("gives a four-digit year less room than a plate, a plate no more than a VIN", () => {
    const rem = (width: string) => Number(/max-w-(\d+)/.exec(width)![1]);
    expect(rem(FIELD_WIDTH.year)).toBeLessThan(rem(FIELD_WIDTH.plate));
    expect(rem(FIELD_WIDTH.plate)).toBeLessThanOrEqual(rem(FIELD_WIDTH.vin));
    expect(rem(FIELD_WIDTH.dni)).toBeLessThanOrEqual(rem(FIELD_WIDTH.phone));
  });
});
