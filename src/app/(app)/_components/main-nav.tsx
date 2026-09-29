"use client";

import { useTranslations } from "next-intl";

import { FloatingNav } from "@/components/shared/floating-nav";
import { NAV_ITEMS } from "@/lib/navigation";

// Lives on the client because icon components are functions, which a Server
// Component can't pass down as props.
export function MainNav() {
  const t = useTranslations("nav");

  const items = NAV_ITEMS.map(({ href, labelKey, icon }) => ({
    href,
    label: t(labelKey),
    icon,
  }));

  return <FloatingNav items={items} ariaLabel={t("ariaLabel")} />;
}
