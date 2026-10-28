"use client";

import { WarningCircleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorScreenProps = {
  title: string;
  hint: string;
  retryLabel: string;
  onRetry: () => void;
  // Left out where there is no router to link with (the root error boundary).
  home?: { label: string; href: string };
  // The error's digest, already formatted ("Código: 123"); it matches the server logs.
  code?: string;
};

// What a page shows when it fails to render (docs/design.md#shared-patterns). Texts come in as props
// because the root error boundary has no translations. It never shows the exception's message.
export function ErrorScreen({ title, hint, retryLabel, onRetry, home, code }: ErrorScreenProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div
      role="alert"
      className="mx-auto mt-12 flex w-full max-w-xl flex-col items-center gap-2 rounded-xl border bg-card px-6 py-12 text-center"
    >
      <WarningCircleIcon aria-hidden="true" className="mb-2 size-10 text-muted-foreground" />
      <h1 ref={titleRef} tabIndex={-1} className="text-lg font-semibold outline-none">
        {title}
      </h1>
      <p className="max-w-[40ch] text-sm text-balance text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-4">
        <button type="button" onClick={onRetry} className={cn(buttonVariants(), "h-9 px-4")}>
          {retryLabel}
        </button>
        {home ? (
          <Link href={home.href} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
            {home.label}
          </Link>
        ) : null}
      </div>
      {code ? <p className="pt-6 text-xs text-muted-foreground tabular-nums select-all">{code}</p> : null}
    </div>
  );
}
