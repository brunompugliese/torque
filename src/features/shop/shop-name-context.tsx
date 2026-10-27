"use client";

import { createContext, useContext, type ReactNode } from "react";

const ShopNameContext = createContext<string | undefined>(undefined);

// The shop's name, read once by the app layout for the top bar and shared with
// client components (the quote message signs with it).
export function ShopNameProvider({ shopName, children }: { shopName: string | undefined; children: ReactNode }) {
  return <ShopNameContext.Provider value={shopName}>{children}</ShopNameContext.Provider>;
}

export function useShopName(): string | undefined {
  return useContext(ShopNameContext);
}
