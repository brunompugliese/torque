import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopNameProvider, useShopName } from "./shop-name-context";

function Name() {
  return <p>{useShopName() ?? "none"}</p>;
}

describe("ShopNameProvider", () => {
  it("gives the shop name to its children", () => {
    render(
      <ShopNameProvider shopName="Taller Ejemplo">
        <Name />
      </ShopNameProvider>,
    );
    expect(screen.getByText("Taller Ejemplo")).toBeInTheDocument();
  });

  it("gives undefined when the name is missing or there is no provider", () => {
    const { unmount } = render(
      <ShopNameProvider shopName={undefined}>
        <Name />
      </ShopNameProvider>,
    );
    expect(screen.getByText("none")).toBeInTheDocument();
    unmount();
    render(<Name />);
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
