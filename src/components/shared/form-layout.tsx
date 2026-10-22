import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Fields in a modal form sit two to a row from the `sm` breakpoint up and stack
// below it (docs/design.md#forms). A field that takes a long value (an email, a
// free text) is alone in its row and takes the whole width.
export function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="form-row" className={cn("grid gap-x-4 gap-y-5 sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}

// A field is only as wide as the longest value it takes: put one of these on its
// `Field` instead of letting a four-digit year stretch like an email. Below `sm`
// every field takes the whole width, as the row stacks.
export const FIELD_WIDTH = {
  // 1886–2027: four digits.
  year: "sm:max-w-24",
  // "AB 123 CD".
  plate: "sm:max-w-36",
  // Up to 8 digits.
  dni: "sm:max-w-36",
  // "11 1234-5678".
  phone: "sm:max-w-44",
  // Exactly 17 characters.
  vin: "sm:max-w-56",
} as const;
