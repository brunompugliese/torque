"use client";

import type { ComponentProps } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { dniDigits } from "@/lib/format/dni";
import { formatPhone } from "@/lib/format/phone";
import { formatPlateInput } from "@/lib/format/plate";
import { formatVinInput } from "@/lib/format/vin";

type FormattedInputProps = Omit<ComponentProps<typeof Input>, "name" | "onChange" | "onBlur" | "ref"> & {
  // What `form.register("field")` returns. Register where the field appears:
  // "focus the first error" follows registration order (docs/conventions.md).
  registration: UseFormRegisterReturn;
  // Cleans or formats what is typed or pasted.
  format: (input: string) => string;
};

// An input that tidies its text as it is typed, before React Hook Form reads it,
// so what the field shows is what the schema sees and the server stores. The
// caret goes to the end when editing in the middle (accepted for short values).
export function FormattedInput({ registration, format, ...props }: FormattedInputProps) {
  return (
    <Input
      {...props}
      {...registration}
      onChange={(event) => {
        event.target.value = format(event.target.value);
        return registration.onChange(event);
      }}
    />
  );
}

type FieldInputProps = Omit<FormattedInputProps, "format">;

// Digits only, formatted as typed ("11 1234-5678").
export function PhoneInput(props: FieldInputProps) {
  return <FormattedInput type="tel" inputMode="tel" autoComplete="off" format={formatPhone} {...props} />;
}

// Digits only, at most 8.
export function DniInput(props: FieldInputProps) {
  return <FormattedInput inputMode="numeric" autoComplete="off" format={dniDigits} {...props} />;
}

// Letters and digits, uppercase, spaced like a plate, at most 7 characters.
export function PlateInput(props: FieldInputProps) {
  return <FormattedInput autoComplete="off" spellCheck={false} format={formatPlateInput} {...props} />;
}

// Uppercase, no spaces or hyphens, at most 17 characters.
export function VinInput(props: FieldInputProps) {
  return <FormattedInput autoComplete="off" spellCheck={false} format={formatVinInput} {...props} />;
}
