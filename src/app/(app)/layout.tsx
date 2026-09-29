import { getTranslations } from "next-intl/server";

import { TopBar } from "@/components/shared/top-bar";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { getShopName } from "@/features/shop/queries";
import { requireSession } from "@/lib/auth/session";

import { MainNav } from "./_components/main-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Layouts don't re-render on client navigation, so every page also calls
  // requireSession(); this call protects the shell itself.
  await requireSession();
  const [t, shopName] = await Promise.all([getTranslations("app"), getShopName()]);

  return (
    <>
      <TopBar appName={t("name")} shopName={shopName ?? undefined} actions={<SignOutButton />} />
      <main className="mx-auto max-w-5xl px-4 pb-[calc(var(--floating-nav-space)+env(safe-area-inset-bottom,0px))] sm:px-6">
        {children}
      </main>
      <MainNav />
    </>
  );
}
