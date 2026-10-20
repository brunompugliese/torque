import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "@/components/ui/skeleton";
import { renderWithIntl } from "@/test/render";

import { LoadingRegion } from "./loading-region";

describe("LoadingRegion", () => {
  it("is busy, announces Cargando… once and hides the blocks from screen readers", () => {
    const { container } = renderWithIntl(
      <LoadingRegion>
        <Skeleton data-testid="block" />
        <Skeleton data-testid="block" />
      </LoadingRegion>,
    );

    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    for (const block of screen.getAllByTestId("block")) {
      expect(block.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });
});

describe("Skeleton", () => {
  it("pulses only when motion is allowed", () => {
    renderWithIntl(<Skeleton data-testid="block" />);
    const block = screen.getByTestId("block");
    expect(block).toHaveClass("motion-safe:animate-pulse");
    expect(block).not.toHaveClass("animate-pulse");
  });
});
