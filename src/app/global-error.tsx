"use client";

import { ErrorScreen } from "@/components/shared/error-screen";

import "./globals.css";

// The root layout failed, so there are no translations, shell or router: the texts are constants.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full px-4">
        <ErrorScreen
          title="Algo salió mal"
          hint={
            error.digest
              ? "No pudimos mostrar esta pantalla. Probá de nuevo; si sigue igual, avisanos con el código."
              : "No pudimos mostrar esta pantalla. Probá de nuevo en un momento."
          }
          retryLabel="Reintentar"
          onRetry={retry}
          code={error.digest ? `Código: ${error.digest}` : undefined}
        />
      </body>
    </html>
  );
}
