"use client";

import { PrinterIcon } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// An image that is still loading settles on load or error; a failed logo falls back to the app's mark.
function imageSettled(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

// Opens the browser's print dialog once the logo and the fonts are ready, once per visit, and keeps
// an "Imprimir" button for printing again. Hidden on paper.
export function PrintControls() {
  const t = useTranslations("jobs.print");

  useEffect(() => {
    let cancelled = false;
    const ready = Promise.all([...Array.from(document.images, imageSettled), document.fonts?.ready]);
    void ready.then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-[210mm] max-w-full items-center justify-between gap-3 px-1 pb-3 print:hidden">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <Button onClick={() => window.print()}>
        <PrinterIcon aria-hidden="true" className="size-4" />
        {t("button")}
      </Button>
    </div>
  );
}
