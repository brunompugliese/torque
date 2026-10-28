"use client";

import { WrenchIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";

import { LogoMark } from "@/components/shared/logo-mark";

type ShopLogoProps = {
  // Where the shop's logo is served. Without it (or if it fails to load) the
  // app's own mark is drawn instead.
  src?: string;
  // Side of the square in pixels.
  size?: number;
};

// A shop's logo in a rounded square, with the app's mark as fallback. Decorative:
// the shop's name is always shown next to it, so it's hidden from screen readers.
export function ShopLogo({ src, size = 40 }: ShopLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  if (!src || failedSrc === src) {
    return (
      <LogoMark size={size}>
        <WrenchIcon size={Math.round(size / 2)} weight="fill" />
      </LogoMark>
    );
  }

  return (
    <span
      aria-hidden="true"
      data-slot="shop-logo"
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background"
      style={{ width: size, height: size }}
    >
      {/* A plain <img> on purpose: Next's image optimizer is for remote or build-time
          images, and this is a private, already-sized file served behind the session. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="size-full object-cover"
        onError={() => setFailedSrc(src)}
      />
    </span>
  );
}
