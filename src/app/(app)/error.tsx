"use client";

import { useTranslations } from "next-intl";

import { ErrorScreen } from "@/components/shared/error-screen";

// Inside the app shell: the header and the navbar stay. `retry` re-fetches the page, unlike `reset`.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errorScreen");

  return (
    <ErrorScreen
      title={t("title")}
      hint={error.digest ? t("hint") : t("hintNoCode")}
      retryLabel={t("retry")}
      onRetry={retry}
      home={{ label: t("home"), href: "/inicio" }}
      code={error.digest ? t("code", { code: error.digest }) : undefined}
    />
  );
}
