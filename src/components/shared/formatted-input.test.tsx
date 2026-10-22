import { fireEvent, render, screen } from "@testing-library/react";
import { useForm, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { DniInput, FormattedInput, PhoneInput, PlateInput, VinInput } from "./formatted-input";

// Shows what React Hook Form read, to prove it never saw the raw text.
function Harness({ children, onValue }: { children: (register: ReturnType<typeof useForm>["register"]) => React.ReactNode; onValue?: (value: unknown) => void }) {
  const form = useForm({ defaultValues: { field: "" } });
  const value = useWatch({ control: form.control, name: "field" });
  onValue?.(value);
  return (
    <>
      {children(form.register as never)}
      <output data-testid="form-value">{String(value)}</output>
    </>
  );
}

function type(text: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
}

describe("FormattedInput", () => {
  it("shows the formatted text and hands the form the formatted text", () => {
    render(
      <Harness>
        {(register) => <FormattedInput aria-label="Campo" registration={register("field")} format={(text) => text.toUpperCase()} />}
      </Harness>,
    );
    type("abc");
    expect(screen.getByRole("textbox")).toHaveValue("ABC");
    expect(screen.getByTestId("form-value")).toHaveTextContent("ABC");
  });

  it("passes the rest of the props to the input", () => {
    render(
      <Harness>
        {(register) => (
          <FormattedInput aria-label="Campo" placeholder="Escribí" registration={register("field")} format={(text) => text} />
        )}
      </Harness>,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Escribí");
  });

  it("calls the form's change handler once per change", () => {
    const onChange = vi.fn();
    render(
      <FormattedInput
        aria-label="Campo"
        format={(text) => text}
        registration={{ name: "field", onChange, onBlur: vi.fn(), ref: vi.fn() }}
      />,
    );
    type("a");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("the field inputs", () => {
  it("PhoneInput keeps digits, drops a leading 0, formats and holds 10 digits", () => {
    render(<Harness>{(register) => <PhoneInput aria-label="Teléfono" registration={register("field")} />}</Harness>);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "tel");
    expect(input).toHaveAttribute("inputmode", "tel");
    type("(011) 1234-5678-99");
    expect(input).toHaveValue("11 1234-5678");
    expect(screen.getByTestId("form-value")).toHaveTextContent("11 1234-5678");
  });

  it("DniInput keeps digits only, at most 8, on a numeric keyboard", () => {
    render(<Harness>{(register) => <DniInput aria-label="DNI" registration={register("field")} />}</Harness>);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("inputmode", "numeric");
    type("28.456.123.999");
    expect(input).toHaveValue("28456123");
  });

  it("PlateInput uppercases, spaces like a plate and holds 7 characters", () => {
    render(<Harness>{(register) => <PlateInput aria-label="Patente" registration={register("field")} />}</Harness>);
    const input = screen.getByRole("textbox");
    type("ab-123 cdxyz");
    expect(input).toHaveValue("AB 123 CD");
    expect(screen.getByTestId("form-value")).toHaveTextContent("AB 123 CD");
  });

  it("VinInput uppercases, drops hyphens and spaces and holds 17 characters", () => {
    render(<Harness>{(register) => <VinInput aria-label="VIN" registration={register("field")} />}</Harness>);
    type("1hg-cm82633a 004352999");
    expect(screen.getByRole("textbox")).toHaveValue("1HGCM82633A004352");
  });
});
