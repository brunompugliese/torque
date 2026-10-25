"use client";

import { Suspense, type ReactNode } from "react";

// Around a modal that loads its code on first use (`next/dynamic`). Without it, the first render of
// the lazy modal suspends to the nearest boundary, which is the route's `loading.tsx`: the whole page
// is swapped for its skeleton and back, and everything on it (an open popover, the calendar) is
// torn down. Here only the modal's own slot waits, and shows nothing while it does.
export function ModalBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
