import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopProvider, useShop, useShopName } from "./shop-context";

const SHOP = { name: "Taller Ejemplo", address: "Calle Falsa 123", phone: "11 5555-0101", hasLogo: true };

function Name() {
  return <p>{useShopName() ?? "none"}</p>;
}

function Details() {
  const shop = useShop();
  return <p>{shop ? `${shop.address}|${shop.phone}|${shop.hasLogo}` : "none"}</p>;
}

describe("ShopProvider", () => {
  it("gives the shop name to its children", () => {
    render(
      <ShopProvider shop={SHOP}>
        <Name />
      </ShopProvider>,
    );
    expect(screen.getByText("Taller Ejemplo")).toBeInTheDocument();
  });

  it("gives the whole shop to its children", () => {
    render(
      <ShopProvider shop={SHOP}>
        <Details />
      </ShopProvider>,
    );
    expect(screen.getByText("Calle Falsa 123|11 5555-0101|true")).toBeInTheDocument();
  });

  it("gives undefined when the shop is missing or there is no provider", () => {
    const { unmount } = render(
      <ShopProvider shop={undefined}>
        <Name />
        <Details />
      </ShopProvider>,
    );
    expect(screen.getAllByText("none")).toHaveLength(2);
    unmount();
    render(<Name />);
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
