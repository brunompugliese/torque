"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Shop } from "./types";

const ShopContext = createContext<Shop | undefined>(undefined);

// The shop, read once by the app layout for the top bar and shared with client
// components (the quote message signs with its name; the print sheet uses its
// address, phone and logo).
export function ShopProvider({ shop, children }: { shop: Shop | undefined; children: ReactNode }) {
  return <ShopContext.Provider value={shop}>{children}</ShopContext.Provider>;
}

export function useShop(): Shop | undefined {
  return useContext(ShopContext);
}

export function useShopName(): string | undefined {
  return useShop()?.name;
}
