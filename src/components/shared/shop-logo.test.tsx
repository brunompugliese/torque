import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopLogo } from "./shop-logo";

describe("ShopLogo", () => {
  it("draws the image in a fixed square, decorative", () => {
    const { container } = render(<ShopLogo src="/logo" size={40} />);
    const image = container.querySelector("img");

    expect(image).toHaveAttribute("src", "/logo");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("width", "40");
    expect(image).toHaveAttribute("height", "40");
    expect(container.querySelector('[data-slot="shop-logo"]')).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector('[data-slot="logo-mark"]')).toBeNull();
  });

  it("draws the app's mark without a source", () => {
    const { container } = render(<ShopLogo />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="logo-mark"]')).toBeInTheDocument();
  });

  it("falls back to the app's mark when the image fails to load", () => {
    const { container } = render(<ShopLogo src="/logo" />);
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="logo-mark"]')).toBeInTheDocument();
  });

  it("tries a new source after a failed one", () => {
    const { container, rerender } = render(<ShopLogo src="/logo" />);
    fireEvent.error(container.querySelector("img")!);
    rerender(<ShopLogo src="/logo?v=2" />);

    expect(container.querySelector("img")).toHaveAttribute("src", "/logo?v=2");
  });
});
