import { WrenchIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FlashToast } from "@/components/shared/flash-toast";
import { LogoMark } from "@/components/shared/logo-mark";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSafeRedirectPath, HOME_PATH, SIGN_OUT_REASONS } from "@/lib/auth/redirects";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("auth.login.title")} · ${t("app.name")}` };
}

// Reasons that explain why the user must sign in again stay on the form.
const REASON_MESSAGES = {
  [SIGN_OUT_REASONS.inactivity]: "sessionExpired",
  [SIGN_OUT_REASONS.account]: "accountUnavailable",
} as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations();
  const { next, motivo } = await searchParams;

  // Sanitized here for the form and again by the Server Action.
  const safeNext = getSafeRedirectPath(next);
  const reason = typeof motivo === "string" ? motivo : undefined;
  const initialError =
    reason && reason in REASON_MESSAGES
      ? REASON_MESSAGES[reason as keyof typeof REASON_MESSAGES]
      : undefined;

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      {/* Product branding, not a shop's: the shop is unknown before sign-in. */}
      <Card className="w-full max-w-[380px] gap-6 rounded-[0.75rem] border border-border py-8 ring-0">
        <CardHeader className="flex flex-col items-center gap-3 px-6 text-center">
          <LogoMark size={64}>
            <WrenchIcon size={32} weight="fill" />
          </LogoMark>
          <p className="text-[17px] font-bold tracking-tight">{t("app.name")}</p>
          <h1 className="text-lg font-semibold">{t("auth.login.title")}</h1>
        </CardHeader>
        <CardContent className="px-6">
          <LoginForm
            next={safeNext === HOME_PATH ? undefined : safeNext}
            initialError={initialError}
          />
        </CardContent>
      </Card>
      {reason === SIGN_OUT_REASONS.signedOut ? (
        <FlashToast id="signed-out" message={t("auth.signedOut")} param="motivo" />
      ) : null}
    </main>
  );
}
