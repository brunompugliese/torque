import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogoMark } from "./logo-mark";

describe("LogoMark", () => {
  it("renders its content in a square of the given size, hidden from screen readers", () => {
    const { container } = render(
      <LogoMark size={64}>
        <svg data-testid="icon" />
      </LogoMark>,
    );
    const mark = container.querySelector('[data-slot="logo-mark"]');
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveStyle({ width: "64px", height: "64px" });
    expect(mark).toHaveClass("bg-primary", "text-primary-foreground");
    expect(mark?.querySelector("svg")).not.toBeNull();
  });

  it("defaults to 40px", () => {
    const { container } = render(<LogoMark>T</LogoMark>);
    expect(container.firstElementChild).toHaveStyle({ width: "40px", height: "40px" });
  });
});
