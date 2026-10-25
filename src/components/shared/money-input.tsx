"use client";

import type { ComponentProps } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatMoneyInput } from "@/lib/format/money";

type MoneyInputProps = Omit<ComponentProps<typeof InputGroupInput>, "name" | "onChange" | "onBlur" | "ref" | "type"> & {
  // What `form.register("field")` returns (see FormattedInput).
  registration: UseFormRegisterReturn;
};

// A price in pesos: a "$" before the text, digits and one decimal comma with up
// to two decimals ("12500,50"). A text input, so the comma stays; the schema
// (`moneyField`) turns the text into a number.
export function MoneyInput({ registration, ...props }: MoneyInputProps) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <span aria-hidden="true">$</span>
      </InputGroupAddon>
      <InputGroupInput
        inputMode="decimal"
        autoComplete="off"
        {...props}
        {...registration}
        onChange={(event) => {
          event.target.value = formatMoneyInput(event.target.value);
          return registration.onChange(event);
        }}
      />
    </InputGroup>
  );
}
