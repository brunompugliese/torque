import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type LogoMarkProps = {
  // Icon or image to show, sized by the caller.
  children: ReactNode;
  // Side of the square in pixels.
  size?: number;
  className?: string;
};

// A brand mark in a rounded square (white on primary). Decorative: the name
// shown next to it carries the meaning, so it's hidden from screen readers.
export function LogoMark({ children, size = 40, className }: LogoMarkProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="logo-mark"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}
