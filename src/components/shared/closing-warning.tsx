import { WarningIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

// A warning in the warning colors (docs/design.md#visual-identity), announced
// when it appears: "Al guardar como entregado, el trabajo queda cerrado…". The
// icon is decoration; the text carries the meaning.
export function ClosingWarning({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning px-3 py-2 text-[13px] text-warning-foreground"
    >
      <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
