import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chooseOption, typeInCombobox } from "@/test/combobox";
import { renderWithIntl } from "@/test/render";

const mocks = vi.hoisted(() => ({ searchVehicleOptions: vi.fn() }));
vi.mock("../actions", () => ({ searchVehicleOptions: mocks.searchVehicleOptions }));

import { VehicleSelect, type VehicleChoice } from "./vehicle-select";

const CRONOS: VehicleChoice = { id: "v1", plate: "AE482KD", brandName: "Fiat", modelName: "Cronos", enabled: true };
const GOL: VehicleChoice = { id: "v2", plate: "AB123CD", brandName: "Volkswagen", modelName: "Gol", enabled: true };

function Harness({
  current,
  onChange = () => {},
  onTextChange,
}: {
  current?: VehicleChoice;
  onChange?: (id: string) => void;
  onTextChange?: (text: string) => void;
}) {
  const [value, setValue] = useState(current?.id ?? "");
  return (
    <VehicleSelect
      id="vehicle"
      value={value}
      current={current}
      onTextChange={onTextChange}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

beforeEach(() => {
  mocks.searchVehicleOptions.mockReset();
  mocks.searchVehicleOptions.mockResolvedValue({ ok: true, rows: [CRONOS, GOL] });
});

describe("VehicleSelect", () => {
  it("searches the server as the user types and shows the model with the plate in grey", async () => {
    renderWithIntl(<Harness />);
    const input = screen.getByPlaceholderText("Buscá por patente, marca o modelo");
    typeInCombobox(input, "ae");

    const option = await screen.findByRole("option", { name: /Fiat Cronos/ });
    expect(option).toHaveTextContent("AE 482 KD");
    expect(mocks.searchVehicleOptions).toHaveBeenCalledWith("ae", undefined);
  });

  it("shows the chosen vehicle as 'Fiat Cronos (AE 482 KD)' and reports it", async () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox");

    await chooseOption(input, "ae", /Fiat Cronos/);

    expect(onChange).toHaveBeenCalledWith("v1");
    await waitFor(() => expect(input).toHaveValue("Fiat Cronos (AE 482 KD)"));
  });

  it("starts with the record's own vehicle chosen, labelled when archived, and asks the server to keep it", async () => {
    renderWithIntl(<Harness current={{ ...GOL, enabled: false }} />);
    expect(screen.getByRole("combobox")).toHaveValue("Volkswagen Gol (Archivado) (AB 123 CD)");
    await waitFor(() => expect(mocks.searchVehicleOptions).toHaveBeenCalledWith(expect.any(String), "v2"));
  });

  it("reports the text in the box", () => {
    const onTextChange = vi.fn();
    renderWithIntl(<Harness onTextChange={onTextChange} />);
    typeInCombobox(screen.getByRole("combobox"), "gol");
    expect(onTextChange).toHaveBeenCalledWith("gol");
  });

  it("clears the choice when the text is edited", async () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox");
    await chooseOption(input, "ae", /Fiat Cronos/);
    onChange.mockClear();

    fireEvent.input(input, { target: { value: "Fiat Cro" }, inputType: "insertText" });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("says when nothing matches", async () => {
    mocks.searchVehicleOptions.mockResolvedValue({ ok: true, rows: [] });
    renderWithIntl(<Harness />);
    typeInCombobox(screen.getByRole("combobox"), "zzz");
    expect(await screen.findByText("No encontramos resultados")).toBeInTheDocument();
  });
});
