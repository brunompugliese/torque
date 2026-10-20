import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("takes its accessible name from a wrapping label, and the whole label toggles it", () => {
    const onCheckedChange = vi.fn();
    renderWithIntl(
      <label>
        <Checkbox onCheckedChange={onCheckedChange} />
        AB 123 CD Fiat Cronos
      </label>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "AB 123 CD Fiat Cronos" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(screen.getByText("AB 123 CD Fiat Cronos"));
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    expect(checkbox).toBeChecked();
  });

  it("is controlled", () => {
    renderWithIntl(<Checkbox checked aria-label="Vehículo" onCheckedChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Vehículo" })).toBeChecked();
  });

  it("can't be toggled when disabled", () => {
    const onCheckedChange = vi.fn();
    renderWithIntl(<Checkbox disabled aria-label="Vehículo" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Vehículo" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
