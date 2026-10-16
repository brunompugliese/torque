"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

type FlashToastProps = {
  // Stable id: sonner ignores a second toast with the same id, so React's
  // double effects in development don't show it twice.
  id: string;
  message: string;
  // Query parameter that triggered the toast; removed from the URL afterwards
  // so reloading the page doesn't show it again.
  param: string;
};

// Shows a one-time toast after a redirect (e.g. "Cerraste sesión.").
export function FlashToast({ id, message, param }: FlashToastProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    toast(message, { id });
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete(param);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [id, message, param, pathname, router, searchParams]);

  return null;
}
