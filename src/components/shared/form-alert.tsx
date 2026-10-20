import { WarningCircleIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// Variants map to semantic theme tokens. Add one (e.g. success) together with
// its token in globals.css; never with literal colors.
const VARIANTS = {
  error: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: WarningCircleIcon,
  },
} as const;

type FormAlertProps = {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
};

// A message about a whole form (not a single field), shown in a tinted box and
// announced by screen readers. Field errors stay as plain text under the field.
export function FormAlert({ children, variant = "error", className }: FormAlertProps) {
  const { className: variantClassName, Icon } = VARIANTS[variant];

  return (
    <Alert className={cn(variantClassName, className)}>
      <Icon aria-hidden="true" weight="fill" />
      <AlertDescription className="text-current">{children}</AlertDescription>
    </Alert>
  );
}
