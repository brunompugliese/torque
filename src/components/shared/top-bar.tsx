import Link from "next/link";
import type { ReactNode } from "react";

import { ShopLogo } from "@/components/shared/shop-logo";
import { HOME_PATH } from "@/lib/auth/redirects";

type TopBarProps = {
  appName: string;
  // Under the shop's name, crediting the app ("by Torque"). Only shown next to a shop's name.
  byline?: string;
  shopName?: string;
  // Where the shop's logo is served; the app's mark is drawn without it.
  logoSrc?: string;
  actions?: ReactNode;
};

// The shop's logo and name on the left, one link to Inicio over the whole block (the full bar height). Without a shop name it shows the app's
// own mark and name, so the bar is never empty.
export function TopBar({ appName, byline, shopName, logoSrc, actions }: TopBarProps) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-8">
        <Link href={HOME_PATH} className="flex min-w-0 items-center gap-3 self-stretch outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ShopLogo src={shopName ? logoSrc : undefined} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[17px] leading-tight font-bold tracking-tight">{shopName ?? appName}</span>
            {shopName && byline ? <span className="truncate text-xs leading-tight text-muted-foreground">{byline}</span> : null}
          </div>
        </Link>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">{actions}</div> : null}
      </div>
    </header>
  );
}
