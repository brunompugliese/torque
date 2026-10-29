import { getTranslations } from "next-intl/server";

import { TopBar } from "@/components/shared/top-bar";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { getShop } from "@/features/shop/queries";
import { ShopProvider } from "@/features/shop/shop-context";
import { SHOP_LOGO_PATH } from "@/features/shop/types";
import { requireSession } from "@/lib/auth/session";

import { MainNav } from "./_components/main-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Layouts don't re-render on client navigation, so every page also calls
  // requireSession(); this call protects the shell itself.
  await requireSession();
  const [t, shop] = await Promise.all([getTranslations("app"), getShop()]);

  return (
    <ShopProvider shop={shop ?? undefined}>
      <TopBar
        appName={t("name")}
        byline={t("byline", { name: t("name") })}
        shopName={shop?.name}
        logoSrc={shop?.hasLogo ? SHOP_LOGO_PATH : undefined}
        actions={<SignOutButton />}
      />
      <main className="mx-auto max-w-7xl px-4 pb-[calc(var(--floating-nav-space)+env(safe-area-inset-bottom,0px))] sm:px-8">
        {children}
      </main>
      <MainNav />
    </ShopProvider>
  );
}
