import { act, render, screen } from "@testing-library/react";
import { Suspense, lazy } from "react";
import { describe, expect, it } from "vitest";

import { ModalBoundary } from "./modal-boundary";

function lazyModal() {
  let load: () => void = () => {};
  const Modal = lazy(
    () =>
      new Promise<{ default: () => React.JSX.Element }>((resolve) => {
        load = () => resolve({ default: () => <p>Modal listo</p> });
      }),
  );
  return { Modal, load: () => load() };
}

describe("ModalBoundary", () => {
  it("keeps the page on screen while a lazy modal loads, instead of the route's fallback", async () => {
    const { Modal, load } = lazyModal();
    render(
      <Suspense fallback={<p>Cargando la página</p>}>
        <p>Calendario</p>
        <ModalBoundary>
          <Modal />
        </ModalBoundary>
      </Suspense>,
    );

    // The modal is still loading: the page behind it is untouched.
    expect(screen.getByText("Calendario")).toBeInTheDocument();
    expect(screen.queryByText("Cargando la página")).toBeNull();
    expect(screen.queryByText("Modal listo")).toBeNull();

    await act(async () => load());
    expect(await screen.findByText("Modal listo")).toBeInTheDocument();
    expect(screen.getByText("Calendario")).toBeInTheDocument();
  });

  it("without it, the same modal swaps the page for the route's fallback (why the boundary exists)", () => {
    const { Modal } = lazyModal();
    render(
      <Suspense fallback={<p>Cargando la página</p>}>
        <p>Calendario</p>
        <Modal />
      </Suspense>,
    );

    expect(screen.getByText("Cargando la página")).toBeInTheDocument();
  });
});
