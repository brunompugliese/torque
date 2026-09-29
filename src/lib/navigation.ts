import {
  CalendarDotsIcon,
  CarIcon,
  HouseIcon,
  UsersIcon,
  WrenchIcon,
  type Icon,
} from "@phosphor-icons/react";

import type messages from "../../messages/es.json";

export type NavLabelKey = Exclude<keyof (typeof messages)["nav"], "ariaLabel">;

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  icon: Icon;
};

// The app's main sections, in the order the navigation shows them.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "home", icon: HouseIcon },
  { href: "/vehiculos", labelKey: "vehicles", icon: CarIcon },
  { href: "/clientes", labelKey: "clients", icon: UsersIcon },
  { href: "/turnos", labelKey: "appointments", icon: CalendarDotsIcon },
  { href: "/trabajos", labelKey: "jobs", icon: WrenchIcon },
];

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

// "/" is active only on the home page; any other section stays active on its
// sub-pages ("/vehiculos/123") but not on lookalike paths ("/vehiculosx").
export function isNavItemActive(pathname: string, href: string): boolean {
  const path = stripTrailingSlash(pathname);
  const target = stripTrailingSlash(href);

  if (target === "/") return path === "/";
  return path === target || path.startsWith(`${target}/`);
}
