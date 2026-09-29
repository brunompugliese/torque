"use client";

import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type FloatingNavItem = {
  href: string;
  label: string;
  icon: Icon;
};

type FloatingNavProps = {
  items: readonly FloatingNavItem[];
  ariaLabel: string;
};

// Fixed to the bottom of the screen. The page layout must reserve
// --floating-nav-space at the bottom so the bar never covers content.
export function FloatingNav({ items, ariaLabel }: FloatingNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--floating-nav-offset)+env(safe-area-inset-bottom,0px))] z-40 flex justify-center px-4"
    >
      <ul className="pointer-events-auto flex h-(--floating-nav-height) w-full max-w-sm items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-lg shadow-foreground/10">
        {items.map(({ href, label, icon: ItemIcon }) => {
          const active = isNavItemActive(pathname, href);

          return (
            <li key={href} className="h-full min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] leading-none font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <ItemIcon
                  aria-hidden="true"
                  size={22}
                  weight={active ? "fill" : "regular"}
                />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
