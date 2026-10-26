import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chooseOption } from "@/test/combobox";
import { renderWithIntl } from "@/test/render";
import { pressOption } from "@/test/select";

import type { AppointmentListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  getOwnerOfVehicle: vi.fn(),
  searchVehicleOptions: vi.fn(),
}));

vi.mock("@/features/job/actions", () => ({ getOwnerOfVehicle: mocks.getOwnerOfVehicle }));
vi.mock("@/features/vehicle/actions", () => ({ searchVehicleOptions: mocks.searchVehicleOptions }));

import { AppointmentForm } from "./appointment-form";

const CRONOS = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const GOL = "ab1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ANA = "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const LUIS = "cd1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const VEHICLE_ROWS = [
  { id: CRONOS, plate: "AE482KD", brandName: "Fiat", modelName: "Cronos", enabled: true },
  { id: GOL, plate: "AB123CD", brandName: "Volkswagen", modelName: "Gol", enabled: true },
];

const APPOINTMENT: AppointmentListItem = {
  id: "a1",
  date: "2026-10-14",
  time: "09:00",
  reason: null,
  status: "confirmado",
  createdAt: "2026-10-13T15:00:00+00:00",
  vehicle: { id: CRONOS, plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: ANA, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  jobId: null,
};

function renderForm(props: { appointment?: AppointmentListItem; date?: string; onSubmit?: () => Promise<unknown> } = {}) {
  const onSubmit = props.onSubmit ?? vi.fn(async () => undefined);
  renderWithIntl(
    <>
      <AppointmentForm
        id="form"
        appointment={props.appointment}
        date={props.date ?? "2026-10-20"}
        onSubmit={onSubmit as never}
      />
      <button type="submit" form="form">
        Guardar
      </button>
    </>,
  );
  return onSubmit;
}

const field = (name: string | RegExp) => screen.getByLabelText(name);
const submit = async () => act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar" })));

async function optionsLoaded() {
  await waitFor(() => expect(mocks.searchVehicleOptions).toHaveBeenCalled());
  await act(async () => {});
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.searchVehicleOptions.mockResolvedValue({ ok: true, rows: VEHICLE_ROWS });
  mocks.getOwnerOfVehicle.mockImplementation(async (vehicleId: string) => ({
    ok: true,
    owner:
      vehicleId === CRONOS
        ? { id: ANA, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true }
        : vehicleId === GOL
          ? null
          : { id: LUIS, name: "Luis", surname: null, phoneNumber: "11 0000-0000", enabled: false },
  }));
});

describe("AppointmentForm layout", () => {
  it("has the vehicle, the client, the date, the time and the reason, and no status on a new appointment", () => {
    renderForm();
    expect(field(/^Vehículo/)).toBeInTheDocument();
    expect(field("Cliente")).toHaveAttribute("readonly");
    expect(field(/^Fecha/)).toHaveValue("2026-10-20");
    // A time field with no steps, empty until the user picks one.
    expect(field(/^Hora/)).toHaveAttribute("type", "time");
    expect(field(/^Hora/)).not.toHaveAttribute("step");
    expect(field(/^Hora/)).toHaveValue("");
    expect(field("Motivo")).toHaveAttribute("placeholder", "Ej.: ruido al frenar, service de los 10.000 km");
    expect(screen.queryByLabelText("Estado")).toBeNull();
  });

  it("has no quick create of a vehicle or a client", async () => {
    renderForm();
    await optionsLoaded();
    fireEvent.focus(field(/^Vehículo/));
    fireEvent.click(field(/^Vehículo/));
    expect(screen.queryByText(/Crear vehículo nuevo/)).toBeNull();
    expect(screen.queryByText(/Crear cliente nuevo/)).toBeNull();
  });

  it("shows the status on an edit, with the four choices", async () => {
    renderForm({ appointment: APPOINTMENT });
    expect(field("Estado")).toHaveTextContent("Confirmado");
    fireEvent.click(field("Estado"));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Pendiente", "Confirmado", "Completado", "Cancelado"]);
  });
});

describe("AppointmentForm client", () => {
  it("asks for a vehicle first, with the hint", () => {
    renderForm();
    expect(field("Cliente")).toHaveValue("Elegí un vehículo");
    expect(screen.getByText("Dueño del vehículo al momento de crear el turno.")).toBeInTheDocument();
  });

  it("shows the owner of the vehicle picked", async () => {
    renderForm();
    await optionsLoaded();
    await chooseOption(field(/^Vehículo/), "ae", /Fiat Cronos/);
    await waitFor(() => expect(field("Cliente")).toHaveValue("Ana Gómez"));
    expect(mocks.getOwnerOfVehicle).toHaveBeenCalledWith(CRONOS);
  });

  it("says when the vehicle has no client", async () => {
    renderForm();
    await optionsLoaded();
    await chooseOption(field(/^Vehículo/), "gol", /Volkswagen Gol/);
    await waitFor(() => expect(field("Cliente")).toHaveValue("El vehículo no tiene cliente"));
  });

  it("marks an archived owner", async () => {
    mocks.searchVehicleOptions.mockResolvedValue({
      ok: true,
      rows: [{ id: "otro", plate: "ZZ999ZZ", brandName: "Ford", modelName: "Ka", enabled: true }],
    });
    renderForm();
    await optionsLoaded();
    await chooseOption(field(/^Vehículo/), "ka", /Ford Ka/);
    await waitFor(() => expect(field("Cliente")).toHaveValue("Luis (Archivado)"));
  });

  it("keeps the stored client on an edit while the vehicle is the same, without asking for an owner", () => {
    renderForm({ appointment: { ...APPOINTMENT, client: { ...APPOINTMENT.client!, name: "Marta" } } });
    expect(field("Cliente")).toHaveValue("Marta Gómez");
    expect(mocks.getOwnerOfVehicle).not.toHaveBeenCalled();
  });

  it("follows the new vehicle's owner when an edit changes the vehicle", async () => {
    renderForm({ appointment: APPOINTMENT });
    await optionsLoaded();
    await chooseOption(field(/^Vehículo/), "gol", /Volkswagen Gol/);
    await waitFor(() => expect(field("Cliente")).toHaveValue("El vehículo no tiene cliente"));
  });

  it("says so when the appointment's own vehicle had no client", () => {
    renderForm({ appointment: { ...APPOINTMENT, client: null } });
    expect(field("Cliente")).toHaveValue("El vehículo no tiene cliente");
  });
});

describe("AppointmentForm validation", () => {
  it("shows every missing field and focuses the first one", async () => {
    const onSubmit = renderForm();
    await submit();

    expect(await screen.findByText("Elegí el vehículo.")).toBeInTheDocument();
    expect(screen.getByText("Elegí la hora.")).toBeInTheDocument();
    expect(field(/^Vehículo/)).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("asks for the date when it is cleared, and focuses it if it is the first error", async () => {
    renderForm({ appointment: APPOINTMENT });
    fireEvent.change(field(/^Fecha/), { target: { value: "" } });
    await submit();

    expect(await screen.findByText("Elegí la fecha.")).toBeInTheDocument();
    expect(field(/^Fecha/)).toHaveFocus();
  });

  it("tells a vehicle typed but not chosen from an empty field", async () => {
    renderForm();
    await optionsLoaded();
    fireEvent.input(field(/^Vehículo/), { target: { value: "fia" }, inputType: "insertText" });
    // The open list hides the rest of the page from the accessibility tree: submit the form itself.
    await act(async () => fireEvent.submit(document.getElementById("form")!));

    expect(await screen.findByText("Elegí un vehículo de la lista.")).toBeInTheDocument();
  });

  it("takes any minute, not only quarter hours", async () => {
    const onSubmit = renderForm({ appointment: APPOINTMENT });
    fireEvent.change(field(/^Hora/), { target: { value: "09:07" } });
    await submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ time: "09:07" })));
    expect(screen.queryByText(/de a 15 minutos/)).toBeNull();
  });

  it("asks for the time when it is cleared", async () => {
    renderForm({ appointment: APPOINTMENT });
    fireEvent.change(field(/^Hora/), { target: { value: "" } });
    await submit();

    expect(await screen.findByText("Elegí la hora.")).toBeInTheDocument();
  });

  it("links an error to its field", async () => {
    renderForm();
    await submit();
    const error = await screen.findByText("Elegí la hora.");
    expect(field(/^Hora/)).toHaveAttribute("aria-invalid", "true");
    expect(field(/^Hora/).getAttribute("aria-describedby")).toBe(error.id);
  });

  it("submits the values once everything is valid", async () => {
    const onSubmit = renderForm({ date: "2026-10-22" });
    await optionsLoaded();
    await chooseOption(field(/^Vehículo/), "ae", /Fiat Cronos/);
    fireEvent.change(field(/^Hora/), { target: { value: "16:45" } });
    fireEvent.change(field("Motivo"), { target: { value: "  Service de los 10.000 km  " } });
    await submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      vehicleId: CRONOS,
      date: "2026-10-22",
      time: "16:45",
      status: "pendiente",
      reason: "Service de los 10.000 km",
    });
  });
});

describe("AppointmentForm server answers", () => {
  it("shows a field error from the server and focuses it", async () => {
    renderForm({
      appointment: APPOINTMENT,
      onSubmit: async () => ({ ok: false, error: "vehicleArchived", fieldErrors: { vehicleId: "vehicleArchived" } }),
    });
    fireEvent.change(field("Motivo"), { target: { value: "otro" } });
    await submit();

    expect(await screen.findByText("Este vehículo está archivado y no puede tener turnos nuevos.")).toBeInTheDocument();
    expect(field(/^Vehículo/)).toHaveFocus();
  });

  it.each([
    ["notFound", "Este turno ya no existe. Actualizá la página."],
    ["unexpected", "Algo salió mal. Probá de nuevo."],
  ])("shows a message for the whole form when the server says %s", async (error, message) => {
    renderForm({ appointment: APPOINTMENT, onSubmit: async () => ({ ok: false, error }) });
    fireEvent.change(field("Motivo"), { target: { value: "otro" } });
    await submit();

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

describe("AppointmentForm cancelling", () => {
  it("asks before saving an edit as cancelled, and saves only once confirmed", async () => {
    const onSubmit = renderForm({ appointment: APPOINTMENT });
    fireEvent.click(field("Estado"));
    pressOption(await screen.findByRole("option", { name: "Cancelado" }));
    await submit();

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Cancelar el turno?");
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" })));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelado" })));
  });

  it("does not ask when the appointment was already cancelled", async () => {
    const onSubmit = renderForm({ appointment: { ...APPOINTMENT, status: "cancelado" } });
    fireEvent.change(field("Motivo"), { target: { value: "otro" } });
    await submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
