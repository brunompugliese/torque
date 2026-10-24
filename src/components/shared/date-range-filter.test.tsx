import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateRangeFilter } from "./date-range-filter";

const PROPS = {
  fromLabel: "Desde",
  toLabel: "Hasta",
  orderError: "La fecha “Desde” no puede ser posterior a “Hasta”.",
};

describe("DateRangeFilter", () => {
  it("shows the applied range", () => {
    render(<DateRangeFilter {...PROPS} value={{ from: "2026-09-01", to: "2026-09-30" }} onChange={() => {}} />);
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-09-30");
  });

  it("applies each bound as it is chosen, the other one left empty", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter {...PROPS} value={{ from: "", to: "" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-01" } });
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-09-01", to: "" });
  });

  it("applies a bound being cleared", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter {...PROPS} value={{ from: "2026-09-01", to: "" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ from: "", to: "" });
  });

  it("allows the same day on both ends", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter {...PROPS} value={{ from: "2026-09-10", to: "" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-10" } });
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-09-10", to: "2026-09-10" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([["0002-02-20"], ["0202-02-20"], ["1899-12-31"]])(
    "does not apply %s, a year still being typed, and the draft keeps it",
    (typed) => {
      const onChange = vi.fn();
      render(<DateRangeFilter {...PROPS} value={{ from: "", to: "" }} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: typed } });
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Hasta")).toHaveValue(typed);
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("applies the day once the year is complete", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter {...PROPS} value={{ from: "", to: "" }} onChange={onChange} />);
    for (const typed of ["0002-02-20", "0020-02-20", "0202-02-20", "2026-02-20"]) {
      fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: typed } });
    }
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ from: "", to: "2026-02-20" });
  });

  it("shows the error and does not apply a Desde later than Hasta", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter {...PROPS} value={{ from: "", to: "2026-09-10" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-20" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(PROPS.orderError);
    expect(screen.getByLabelText("Desde")).toBeInvalid();
    expect(screen.getByLabelText("Desde")).toHaveAccessibleDescription(PROPS.orderError);
  });

  it("goes back to applying once the order is fixed", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter {...PROPS} value={{ from: "", to: "2026-09-10" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-20" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-05" } });
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-09-05", to: "2026-09-10" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("follows the applied range when it changes elsewhere", () => {
    const { rerender } = render(
      <DateRangeFilter {...PROPS} value={{ from: "2026-09-01", to: "2026-09-30" }} onChange={() => {}} />,
    );
    rerender(<DateRangeFilter {...PROPS} value={{ from: "", to: "" }} onChange={() => {}} />);
    expect(screen.getByLabelText("Desde")).toHaveValue("");
    expect(screen.getByLabelText("Hasta")).toHaveValue("");
  });
});
