import { fireEvent } from "@testing-library/react";

// A Select option is chosen on pointer release, as a mouse does it.
export function pressOption(option: HTMLElement) {
  fireEvent.pointerDown(option);
  fireEvent.mouseDown(option);
  fireEvent.pointerUp(option);
  fireEvent.mouseUp(option);
  fireEvent.click(option);
}
