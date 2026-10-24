import { fireEvent, render, screen } from "@testing-library/react";
import { useForm, useWatch } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { MoneyInput } from "./money-input";

function Harness() {
  const form = useForm({ defaultValues: { price: "" } });
  const value = useWatch({ control: form.control, name: "price" });
  return (
    <>
      <MoneyInput aria-label="Precio" registration={form.register("price")} />
      <output data-testid="form-value">{value}</output>
    </>
  );
}

describe("MoneyInput", () => {
  it("shows a $ before the text and keeps it out of the value", () => {
    render(<Harness />);
    expect(screen.getByText("$")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Precio" }), { target: { value: "12500,50" } });
    expect(screen.getByRole("textbox", { name: "Precio" })).toHaveValue("12500,50");
    expect(screen.getByTestId("form-value")).toHaveTextContent("12500,50");
  });

  it("drops what a price cannot have, as it is typed", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Precio" });
    fireEvent.change(input, { target: { value: "12.500abc,505" } });
    expect(input).toHaveValue("12500,50");
    expect(screen.getByTestId("form-value")).toHaveTextContent("12500,50");
  });

  it("opens the decimal keyboard", () => {
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: "Precio" })).toHaveAttribute("inputmode", "decimal");
  });
});
