import { getTranslations } from "next-intl/server";

import { TopBar } from "@/components/shared/top-bar";

import { MainNav } from "./_components/main-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app");

  return (
    <>
      {/* The shop name is added by the auth spec, once a session exists. */}
      <TopBar appName={t("name")} />
      <main className="mx-auto max-w-5xl px-4 pb-[calc(var(--floating-nav-space)+env(safe-area-inset-bottom,0px))] sm:px-6">
        {children}
      </main>
      <MainNav />
    </>
  );
}
