import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { SearchableSelect, type SelectAction, type SelectOption } from "./searchable-select";

const OPTIONS: SelectOption[] = [
  { value: "1", label: "Álvaro Núñez", secondary: "11 4444-5555" },
  { value: "2", label: "Martín Suárez", secondary: "11 5555-0101" },
  { value: "3", label: "Zoe", secondary: "11 1" },
];

type HarnessProps = {
  options?: SelectOption[];
  filter?: "local" | "remote";
  loading?: boolean;
  disabled?: boolean;
  action?: SelectAction;
  clearLabel?: string;
  initialValue?: string;
  onValue?: (value: string) => void;
  onText?: (text: string) => void;
};

// The caller owns the value and the text, as a form does.
function Harness({ options = OPTIONS, initialValue = "", onValue, onText, ...rest }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  const [text, setText] = useState(options.find((option) => option.value === initialValue)?.label ?? "");
  return (
    <>
      <SearchableSelect
        id="client"
        options={options}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        inputValue={text}
        onInputValueChange={(next) => {
          setText(next);
          onText?.(next);
        }}
        placeholder="Buscar cliente"
        emptyText="No encontramos clientes"
        {...rest}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

function box() {
  return screen.getByRole("combobox");
}

function type(text: string) {
  act(() => box().focus());
  // Base UI opens the list only for real typing, which has an inputType.
  fireEvent.input(box(), { target: { value: text }, inputType: "insertText" });
}

// Opens the list from the keyboard (a click opens it too, but jsdom's pointer events don't).
function open() {
  act(() => box().focus());
  fireEvent.keyDown(box(), { key: "ArrowDown" });
}

function optionNames() {
  return screen.queryAllByRole("option").map((option) => option.textContent);
}

// The popup mounts after the input event, so wait for what it should list.
async function expectOptions(expected: string[]) {
  await waitFor(() => expect(optionNames()).toEqual(expected));
}

describe("SearchableSelect", () => {
  it("is a combobox with its placeholder and an id for its label", () => {
    renderWithIntl(<Harness />);
    expect(box()).toHaveAttribute("id", "client");
    expect(box()).toHaveAttribute("placeholder", "Buscar cliente");
  });

  it("filters as the user types, ignoring case, accents and spaces, and matching the grey text too", async () => {
    renderWithIntl(<Harness />);
    type("alvaro");
    await expectOptions(["Álvaro Núñez11 4444-5555"]);

    type("MARTIN SUAREZ");
    await expectOptions(["Martín Suárez11 5555-0101"]);

    type("55550101");
    await expectOptions(["Martín Suárez11 5555-0101"]);
  });

  it("shows the main text with the secondary text in grey", async () => {
    renderWithIntl(<Harness />);
    type("zoe");
    const option = await screen.findByRole("option");
    expect(within(option).getByText("Zoe")).toBeInTheDocument();
    expect(within(option).getByText("11 1")).toHaveClass("text-muted-foreground");
  });

  it("picks an option with the arrow keys and Enter, and shows its name", async () => {
    const onValue = vi.fn();
    renderWithIntl(<Harness onValue={onValue} />);
    type("mar");
    await expectOptions(["Martín Suárez11 5555-0101"]);
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "Enter" });
    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith("2"));
    expect(box()).toHaveValue("Martín Suárez");
    expect(screen.getByTestId("value")).toHaveTextContent("2");
  });

  it("shows the option's longer text in the box once chosen, and keeps the choice while it is untouched", async () => {
    const options: SelectOption[] = [
      { value: "v1", label: "Fiat Cronos", secondary: "AD 915 TB", inputLabel: "Fiat Cronos (AD 915 TB)" },
    ];
    const onValue = vi.fn();
    renderWithIntl(<Harness options={options} onValue={onValue} />);
    type("cro");
    fireEvent.click(await screen.findByRole("option"));
    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith("v1"));
    expect(box()).toHaveValue("Fiat Cronos (AD 915 TB)");
    expect(screen.getByTestId("value")).toHaveTextContent("v1");

    // Typing again drops the choice, as for any option.
    type("Fiat Cronos (AD 915 T");
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent(/^$/));
  });

  it("picks an option with a click", async () => {
    renderWithIntl(<Harness />);
    type("zo");
    fireEvent.click(await screen.findByRole("option", { name: /Zoe/ }));
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("3"));
    expect(box()).toHaveValue("Zoe");
  });

  it("clears the choice when the user edits the name, keeping what they typed", () => {
    const onText = vi.fn();
    renderWithIntl(<Harness initialValue="2" onText={onText} />);
    expect(box()).toHaveValue("Martín Suárez");

    type("Martín Su");
    expect(screen.getByTestId("value")).toHaveTextContent("");
    expect(onText).toHaveBeenLastCalledWith("Martín Su");
    expect(box()).toHaveValue("Martín Su");
  });

  describe("clear button", () => {
    it("is not there unless the field asks for it", () => {
      renderWithIntl(<Harness initialValue="2" />);
      expect(screen.queryByRole("button", { name: "Quitar cliente" })).toBeNull();
    });

    it("is not there while the field is empty", () => {
      renderWithIntl(<Harness clearLabel="Quitar cliente" />);
      expect(screen.queryByRole("button", { name: "Quitar cliente" })).toBeNull();
    });

    it("empties the choice and the text, and tells the form", async () => {
      const onValue = vi.fn();
      const onText = vi.fn();
      renderWithIntl(<Harness initialValue="2" clearLabel="Quitar cliente" onValue={onValue} onText={onText} />);
      expect(box()).toHaveValue("Martín Suárez");

      fireEvent.click(screen.getByRole("button", { name: "Quitar cliente" }));
      await waitFor(() => expect(box()).toHaveValue(""));
      expect(screen.getByTestId("value")).toHaveTextContent("");
      expect(onValue).toHaveBeenLastCalledWith("");
      expect(onText).toHaveBeenLastCalledWith("");
      expect(screen.queryByRole("button", { name: "Quitar cliente" })).toBeNull();
    });

    it("shows only for a chosen option: text that matches nothing is erased by hand", async () => {
      renderWithIntl(<Harness clearLabel="Quitar cliente" />);
      type("zzz");
      await waitFor(() => expect(box()).toHaveValue("zzz"));
      expect(screen.queryByRole("button", { name: "Quitar cliente" })).toBeNull();
    });
  });

  it("keeps text that matches no option, so the form can reject it", async () => {
    renderWithIntl(<Harness />);
    type("zzz");
    await expectOptions([]);
    act(() => box().blur());
    expect(box()).toHaveValue("zzz");
    expect(screen.getByTestId("value")).toHaveTextContent("");
  });

  it("lists every option when it opens with a choice already made", async () => {
    renderWithIntl(<Harness initialValue="2" />);
    open();
    await waitFor(() => expect(optionNames()).toHaveLength(3));
  });

  it("says when there are no options", async () => {
    renderWithIntl(<Harness options={[]} />);
    open();
    expect(await screen.findByText("No encontramos clientes")).toBeInTheDocument();
  });

  it("says it is loading instead of an empty list", async () => {
    renderWithIntl(<Harness options={[]} loading />);
    open();
    expect(await screen.findByText("Cargando…")).toBeInTheDocument();
    expect(screen.queryByText("No encontramos clientes")).toBeNull();
  });

  it("in remote mode shows the options as they come, without filtering them", async () => {
    const onText = vi.fn();
    renderWithIntl(<Harness filter="remote" onText={onText} />);
    type("zzz");
    expect(onText).toHaveBeenLastCalledWith("zzz");
    await waitFor(() => expect(optionNames()).toHaveLength(3));
  });

  it("knows the chosen option even when the options on screen don't hold it (remote search)", () => {
    const onValue = vi.fn();
    const onText = vi.fn();
    renderWithIntl(
      <SearchableSelect
        id="client"
        options={[OPTIONS[2]]}
        selectedOption={OPTIONS[1]}
        value="2"
        onValueChange={onValue}
        inputValue="Martín Suárez"
        onInputValueChange={onText}
        filter="remote"
        emptyText="No encontramos clientes"
      />,
    );
    expect(box()).toHaveValue("Martín Suárez");

    // Editing the name drops the choice even though its option isn't listed now.
    type("Martín Su");
    expect(onText).toHaveBeenLastCalledWith("Martín Su");
    expect(onValue).toHaveBeenLastCalledWith("");
  });

  it("is disabled", () => {
    renderWithIntl(<Harness disabled />);
    expect(box()).toBeDisabled();
  });

  it("is linked to its error", () => {
    renderWithIntl(
      <SearchableSelect
        id="client"
        options={OPTIONS}
        value=""
        onValueChange={() => {}}
        inputValue=""
        onInputValueChange={() => {}}
        emptyText="No encontramos clientes"
        invalid
        describedBy="client-error"
      />,
    );
    expect(box()).toHaveAttribute("aria-invalid", "true");
    expect(box()).toHaveAttribute("aria-describedby", "client-error");
  });

  describe("with an action", () => {
    it("always lists it last, whatever is typed, and calls it without choosing anything", async () => {
      const onSelect = vi.fn();
      const onValue = vi.fn();
      renderWithIntl(<Harness action={{ label: "Crear cliente nuevo", onSelect }} onValue={onValue} />);

      type("zzz");
      await expectOptions(["Crear cliente nuevo"]);
      fireEvent.click(screen.getByRole("option", { name: "Crear cliente nuevo" }));
      await waitFor(() => expect(onSelect).toHaveBeenCalledOnce());
      expect(onValue).not.toHaveBeenCalled();
      expect(screen.getByTestId("value")).toHaveTextContent("");
      expect(box()).toHaveValue("zzz");
    });

    it("sits after the matching options", async () => {
      renderWithIntl(<Harness action={{ label: "Crear cliente nuevo", onSelect: () => {} }} />);
      type("zo");
      await expectOptions(["Zoe11 1", "Crear cliente nuevo"]);
    });
  });
});
