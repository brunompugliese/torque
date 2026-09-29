import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSafeRedirectPath, HOME_PATH, SIGN_OUT_REASONS } from "@/lib/auth/redirects";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("auth.login.title")} · ${t("app.name")}` };
}

const REASON_MESSAGES = {
  [SIGN_OUT_REASONS.inactivity]: "sessionExpired",
  [SIGN_OUT_REASONS.account]: "accountUnavailable",
} as const;

export default async function LoginPage({ searchParams }: PageProps<"/ingresar">) {
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
      <div className="flex w-full max-w-sm flex-col gap-6">
        <p className="text-center text-lg font-semibold tracking-tight">{t("app.name")}</p>
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              <h1 className="text-xl font-semibold tracking-tight">{t("auth.login.title")}</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm
              next={safeNext === HOME_PATH ? undefined : safeNext}
              initialError={initialError}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
