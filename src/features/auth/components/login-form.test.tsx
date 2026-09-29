import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/es.json";

const signIn = vi.hoisted(() => vi.fn());

vi.mock("../actions", () => ({ signIn }));

import { LoginForm } from "./login-form";

function renderForm(props: Parameters<typeof LoginForm>[0] = {}) {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <LoginForm {...props} />
    </NextIntlClientProvider>,
  );
  return {
    email: screen.getByLabelText("Email"),
    password: screen.getByLabelText("Contraseña"),
    submit: screen.getByRole("button", { name: "Iniciar sesión" }),
  };
}

describe("LoginForm", () => {
  beforeEach(() => {
    signIn.mockReset();
    signIn.mockResolvedValue({ status: "idle" });
  });

  it("sets up the fields for password managers and focuses the email", () => {
    const { email, password } = renderForm();
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(email).toHaveFocus();
  });

  it("shows Spanish field errors and doesn't call the server for invalid input", async () => {
    const { email, password, submit } = renderForm();
    fireEvent.change(email, { target: { value: "no-es-email" } });
    fireEvent.click(submit);

    expect(await screen.findByText("Ingresá un email válido.")).toBeInTheDocument();
    expect(screen.getByText("Ingresá tu contraseña.")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "email-error");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("sends valid input with next, then shows the tinted server error and clears only the password", async () => {
    signIn.mockResolvedValue({ status: "error", formError: "invalidCredentials" });
    const { email, password, submit } = renderForm({ next: "/turnos" });
    fireEvent.change(email, { target: { value: "persona@taller.com" } });
    fireEvent.change(password, { target: { value: "una-clave-larga" } });
    await act(async () => fireEvent.click(submit));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    const data = signIn.mock.calls[0][1] as FormData;
    expect(data.get("email")).toBe("persona@taller.com");
    expect(data.get("next")).toBe("/turnos");

    const alert = await screen.findByText("Email o contraseña incorrectos.");
    expect(alert.closest("[role=alert]")).toHaveClass("bg-destructive/10");
    expect(email).toHaveValue("persona@taller.com");
    expect(password).toHaveValue("");
  });

  it("shows why the user was signed out", () => {
    renderForm({ initialError: "sessionExpired" });
    expect(
      screen.getByText("Tu sesión se cerró por inactividad. Iniciá sesión de nuevo."),
    ).toBeInTheDocument();
  });

  it("disables the button while signing in", async () => {
    let resolve: (value: unknown) => void = () => {};
    signIn.mockReturnValue(new Promise((r) => (resolve = r)));
    const { email, password, submit } = renderForm();
    fireEvent.change(email, { target: { value: "persona@taller.com" } });
    fireEvent.change(password, { target: { value: "una-clave-larga" } });
    fireEvent.click(submit);

    const pending = await screen.findByRole("button", { name: "Iniciando sesión…" });
    expect(pending).toBeDisabled();
    await act(async () => resolve({ status: "idle" }));
  });
});
