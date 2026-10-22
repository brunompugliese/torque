import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

// Types into a SearchableSelect's box. Base UI opens the list only for real
// typing, which carries an inputType that jsdom's events lack.
export function typeInCombobox(input: HTMLElement, text: string) {
  act(() => input.focus());
  fireEvent.input(input, { target: { value: text }, inputType: "insertText" });
}

// Types and picks the option with that name once the list shows it.
export async function chooseOption(input: HTMLElement, text: string, optionName: string | RegExp) {
  typeInCombobox(input, text);
  fireEvent.click(await screen.findByRole("option", { name: optionName }));
  await waitFor(() => expect(screen.queryByRole("option", { name: optionName })).toBeNull());
}
