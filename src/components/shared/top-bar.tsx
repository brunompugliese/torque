import type { ReactNode } from "react";

import { ShopLogo } from "@/components/shared/shop-logo";

type TopBarProps = {
  appName: string;
  shopName?: string;
  // Where the shop's logo is served; the app's mark is drawn without it.
  logoSrc?: string;
  actions?: ReactNode;
};

// The shop's logo and name on the left. Without a shop name it shows the app's
// own mark and name, so the bar is never empty.
export function TopBar({ appName, shopName, logoSrc, actions }: TopBarProps) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-8">
        <ShopLogo src={shopName ? logoSrc : undefined} />
        <span className="truncate text-[17px] font-bold tracking-tight">{shopName ?? appName}</span>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">{actions}</div> : null}
      </div>
    </header>
  );
}
