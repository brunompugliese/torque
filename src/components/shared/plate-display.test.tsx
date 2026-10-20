import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlateDisplay } from "./plate-display";

describe("PlateDisplay", () => {
  it.each([
    ["AB123CD", "AB 123 CD"],
    ["ABC123", "ABC 123"],
    ["ab 123 cd", "AB 123 CD"],
    ["m123abc", "M123ABC"],
  ])("shows %s as %s", (plate, text) => {
    render(<PlateDisplay plate={plate} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("draws the plate with the plate tokens and the blue band", () => {
    const { container } = render(<PlateDisplay plate="AB123CD" />);
    const plate = container.querySelector('[data-slot="plate"]');
    expect(plate).toHaveClass("bg-plate", "text-plate-foreground", "border-plate-foreground");
    expect(container.querySelector('[data-slot="plate-band"]')).toHaveClass("bg-plate-band");
  });

  it("hides the decorative band from screen readers and exposes the plate as text", () => {
    const { container } = render(<PlateDisplay plate="AB123CD" />);
    expect(container.querySelector('[data-slot="plate-band"]')).toHaveAttribute("aria-hidden", "true");
    expect(container).toHaveTextContent("AB 123 CD");
  });

  it("accepts extra classes", () => {
    const { container } = render(<PlateDisplay plate="AB123CD" className="mx-auto" />);
    expect(container.querySelector('[data-slot="plate"]')).toHaveClass("mx-auto");
  });
});
