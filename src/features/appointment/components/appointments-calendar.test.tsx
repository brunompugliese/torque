import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { addDays, addMonths, monthStart, shiftAnchor, todayIsoDate, visibleRange } from "@/lib/calendar";
import { formatIsoDate } from "@/lib/format/date";
import { chooseOption } from "@/test/combobox";
import { renderWithIntl } from "@/test/render";
import { pressOption } from "@/test/select";

import type { CalendarState } from "../calendar-params";
import type { AppointmentRange } from "../queries";
import type { AppointmentListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  searchAppointments: vi.fn(),
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  setAppointmentStatus: vi.fn(),
  createJobFromAppointment: vi.fn(),
  getJobRow: vi.fn(),
  getOwnerOfVehicle: vi.fn(),
  searchVehicleOptions: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  searchAppointments: mocks.searchAppointments,
  createAppointment: mocks.createAppointment,
  updateAppointment: mocks.updateAppointment,
  setAppointmentStatus: mocks.setAppointmentStatus,
  createJobFromAppointment: mocks.createJobFromAppointment,
}));
vi.mock("@/features/job/actions", () => ({
  getJobRow: mocks.getJobRow,
  getJobDetails: vi.fn(async () => ({ ok: true, items: [], history: [] })),
  getOwnerOfVehicle: mocks.getOwnerOfVehicle,
  setJobArchived: vi.fn(),
  setJobStatus: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  getVehicleKmFloor: vi.fn(async () => ({ ok: true, floor: null })),
  getServiceOptions: vi.fn(async () => ({ ok: true, rows: [] })),
}));
vi.mock("@/features/vehicle/actions", () => ({ searchVehicleOptions: mocks.searchVehicleOptions }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { AppointmentsCalendar } from "./appointments-calendar";
import { AppointmentsPanel } from "./appointments-panel";
import { NewAppointmentButton } from "./new-appointment-button";

beforeAll(async () => {
  await import("./appointment-modal");
});

const TODAY = todayIsoDate();
const MONTH: CalendarState = { view: "month", anchor: monthStart(TODAY) };
const CRONOS = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function appointment(id: string, date: string, time: string, overrides: Partial<AppointmentListItem> = {}): AppointmentListItem {
  return {
    id,
    date,
    time,
    reason: null,
    status: "pendiente",
    createdAt: "2026-10-13T15:00:00+00:00",
    vehicle: { id: CRONOS, plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
    client: { id: "c1", name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
    jobId: null,
    ...overrides,
  };
}

function ok(...rows: AppointmentListItem[]): AppointmentRange {
  return { ok: true, rows };
}

function renderCalendar(initial: AppointmentRange, state: CalendarState = MONTH) {
  return renderWithIntl(
    <AppointmentsPanel>
      <NewAppointmentButton />
      <AppointmentsCalendar initial={initial} initialState={state} />
    </AppointmentsPanel>,
  );
}

const day = (date: string) => screen.getByRole("group", { name: formatIsoDate(date) });

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
  mocks.searchAppointments.mockResolvedValue(ok());
  mocks.searchVehicleOptions.mockResolvedValue({
    ok: true,
    rows: [{ id: CRONOS, plate: "AE482KD", brandName: "Fiat", modelName: "Cronos", enabled: true }],
  });
  mocks.getOwnerOfVehicle.mockResolvedValue({ ok: true, owner: null });
  window.history.replaceState(null, "", "/turnos");
});

describe("AppointmentsCalendar", () => {
  it("shows the month with its appointments as cards", () => {
    renderCalendar(ok(appointment("a1", TODAY, "09:00"), appointment("a2", TODAY, "15:30", { status: "confirmado" })));
    const today = day(TODAY);
    expect(within(today).getByRole("button", { name: "09:00, Fiat Cronos, Pendiente" })).toBeInTheDocument();
    expect(within(today).getByRole("button", { name: "15:30, Fiat Cronos, Confirmado" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Estados de los turnos" })).toBeInTheDocument();
    expect(mocks.searchAppointments).not.toHaveBeenCalled();
  });

  it("shows an error with 'Reintentar' when the first range failed, and loads again", async () => {
    mocks.searchAppointments.mockResolvedValue(ok(appointment("a1", TODAY, "09:00")));
    renderCalendar({ ok: false });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await within(day(TODAY)).findByRole("button", { name: /09:00/ })).toBeInTheDocument();
    const range = visibleRange("month", MONTH.anchor);
    expect(mocks.searchAppointments).toHaveBeenCalledWith(range.from, range.to);
  });

  it("loads only the new range when the month changes, with the grid kept and its days empty meanwhile", async () => {
    let answer: (value: AppointmentRange) => void = () => {};
    mocks.searchAppointments.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderCalendar(ok(appointment("a1", TODAY, "09:00")));

    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));

    const next = shiftAnchor("month", MONTH.anchor, 1);
    const range = visibleRange("month", next);
    expect(mocks.searchAppointments).toHaveBeenCalledWith(range.from, range.to);
    expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /09:00/ })).toBeNull();

    const nextDay = addDays(next, 3);
    await act(async () => answer(ok(appointment("a9", nextDay, "11:00"))));
    expect(await within(day(nextDay)).findByRole("button", { name: /11:00/ })).toBeInTheDocument();
  });

  it("keeps the view and the date in the URL, leaving out the defaults", async () => {
    renderCalendar(ok());
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    await waitFor(() => expect(window.location.search).toBe("?vista=semana"));

    fireEvent.click(screen.getByRole("button", { name: "7 días siguientes" }));
    await waitFor(() => expect(window.location.search).toBe(`?vista=semana&fecha=${addDays(TODAY, 7)}`));
  });

  it("opens an appointment's modal from its card", async () => {
    renderCalendar(ok(appointment("a1", TODAY, "09:00", { reason: "Ruido al frenar" })));

    fireEvent.click(within(day(TODAY)).getByRole("button", { name: /09:00/ }));

    expect(await screen.findByRole("heading", { name: `${formatIsoDate(TODAY)} · 09:00 hs` })).toBeInTheDocument();
    expect(screen.getByText("Ruido al frenar")).toBeInTheDocument();
  });

  it("opens 'Nuevo turno' on the day whose empty part or '+' was clicked", async () => {
    renderCalendar(ok());
    const target = TODAY;

    fireEvent.click(screen.getByRole("button", { name: `Nuevo turno el ${formatIsoDate(target)}` }));

    expect(await screen.findByRole("heading", { name: "Nuevo turno" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Fecha/)).toHaveValue(target);
  });

  it("opens 'Nuevo turno' on today from the page's button", async () => {
    renderCalendar(ok());

    fireEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));

    expect(await screen.findByRole("heading", { name: "Nuevo turno" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Fecha/)).toHaveValue(TODAY);
  });

  it("goes to the month of a saved appointment and closes the modal", async () => {
    const farDay = `${addMonths(TODAY, 2).slice(0, 8)}10`;
    mocks.createAppointment.mockResolvedValue({ ok: true, data: appointment("new", farDay, "10:30") });
    mocks.searchAppointments.mockResolvedValue(ok(appointment("new", farDay, "10:30")));
    renderCalendar(ok());

    fireEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));
    await screen.findByRole("heading", { name: "Nuevo turno" });
    await waitFor(() => expect(mocks.searchVehicleOptions).toHaveBeenCalled());
    await act(async () => {});
    await chooseOption(screen.getByLabelText(/^Vehículo/), "ae", /Fiat Cronos/);
    fireEvent.change(screen.getByLabelText(/^Fecha/), { target: { value: farDay } });
    fireEvent.change(screen.getByLabelText(/^Hora/), { target: { value: "10:30" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Agregar turno" })));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Nuevo turno" })).toBeNull());
    const anchor = monthStart(farDay);
    const range = visibleRange("month", anchor);
    await waitFor(() => expect(mocks.searchAppointments).toHaveBeenCalledWith(range.from, range.to));
    expect(await within(day(farDay)).findByRole("button", { name: /10:30/ })).toBeInTheDocument();
    // The saved appointment's modal does not open afterwards.
    expect(screen.queryByRole("heading", { name: /· 10:30 hs/ })).toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith("Turno agregado", expect.anything());
  });
});

describe("AppointmentsCalendar crowded day", () => {
  const crowded = ["08:00", "09:00", "10:00", "11:00"].map((time, index) => appointment(`a${index}`, TODAY, time));

  it("lists three and opens all of them in a popover titled with the date", async () => {
    renderCalendar(ok(...crowded));
    expect(within(day(TODAY)).getAllByRole("button", { name: /Fiat Cronos/ })).toHaveLength(3);

    fireEvent.click(within(day(TODAY)).getByRole("button", { name: "+1 más" }));

    expect(await screen.findByText(formatIsoDate(TODAY), { selector: "[data-slot=popover-title]" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /AE 482 KD/ })).toHaveLength(4);
  });

  const listTitle = () => screen.queryByText(formatIsoDate(TODAY), { selector: "[data-slot=popover-title]" });
  const itemButton = () => screen.findByRole("button", { name: "11:00, Fiat Cronos, AE 482 KD, Pendiente" });

  it("opens an appointment from the popover, with no 'Volver', and the popover makes room for the modal", async () => {
    renderCalendar(ok(...crowded));
    fireEvent.click(within(day(TODAY)).getByRole("button", { name: "+1 más" }));
    fireEvent.click(await itemButton());

    expect(await screen.findByRole("heading", { name: `${formatIsoDate(TODAY)} · 11:00 hs` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver" })).toBeNull();
    await waitFor(() => expect(listTitle()).toBeNull());
  });

  it("opens the popover again, on the same appointment, when the modal is closed", async () => {
    renderCalendar(ok(...crowded));
    fireEvent.click(within(day(TODAY)).getByRole("button", { name: "+1 más" }));
    fireEvent.click(await itemButton());
    await screen.findByRole("heading", { name: `${formatIsoDate(TODAY)} · 11:00 hs` });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(listTitle()).not.toBeNull());
    const back = await itemButton();
    await waitFor(() => expect(back).toHaveFocus());
  });

  it("opens the popover again when the modal closes after an action", async () => {
    mocks.setAppointmentStatus.mockResolvedValue({ ok: true, data: appointment("a3", TODAY, "11:00", { status: "confirmado" }) });
    renderCalendar(ok(...crowded));
    fireEvent.click(within(day(TODAY)).getByRole("button", { name: "+1 más" }));
    fireEvent.click(await itemButton());
    fireEvent.click(await screen.findByRole("combobox", { name: "Cambiar estado: Pendiente" }));
    pressOption(await screen.findByRole("option", { name: "Confirmado" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /· 11:00 hs/ })).toBeNull());
    await waitFor(() => expect(listTitle()).not.toBeNull());
  });

  it("does not open the popover when the appointment came from the day itself", async () => {
    renderCalendar(ok(...crowded));
    fireEvent.click(within(day(TODAY)).getByRole("button", { name: /08:00/ }));
    await screen.findByRole("heading", { name: `${formatIsoDate(TODAY)} · 08:00 hs` });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /· 08:00 hs/ })).toBeNull());
    expect(listTitle()).toBeNull();
  });
});

describe("AppointmentsCalendar job step", () => {
  it("opens the appointment's job with 'Volver' back to the appointment", async () => {
    mocks.getJobRow.mockResolvedValue({
      ok: true,
      row: {
        id: "j1",
        status: "pendiente",
        observations: null,
        kilometers: null,
        quotedTotal: null,
        finalTotal: null,
        enabled: true,
        createdAt: "2026-10-14T15:00:00+00:00",
        updatedAt: "2026-10-14T15:00:00+00:00",
        vehicle: appointment("x", TODAY, "09:00").vehicle,
        client: null,
        appointment: null,
      },
    });
    renderCalendar(ok(appointment("a1", TODAY, "09:00", { jobId: "j1" })));

    fireEvent.click(within(day(TODAY)).getByRole("button", { name: /09:00/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver trabajo" }));
    expect(await screen.findByText("Fiat Cronos 2021")).toBeInTheDocument();
    expect(mocks.getJobRow).toHaveBeenCalledWith("j1");

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(await screen.findByRole("heading", { name: `${formatIsoDate(TODAY)} · 09:00 hs` })).toBeInTheDocument();
  });
});

describe("AppointmentsCalendar on Inicio (fixed week, no URL)", () => {
  const WEEK: CalendarState = { view: "week", anchor: TODAY };

  function renderHome(initial: AppointmentRange) {
    return renderWithIntl(
      <AppointmentsPanel>
        <NewAppointmentButton />
        <AppointmentsCalendar initial={initial} initialState={WEEK} fixedView="week" syncUrl={false} />
      </AppointmentsPanel>,
    );
  }

  it("shows the next seven days without the Mes / Semana toggle", () => {
    renderHome(ok(appointment("a1", TODAY, "09:00")));
    expect(screen.getByRole("heading", { name: `${formatIsoDate(TODAY)} al ${formatIsoDate(addDays(TODAY, 6))}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Semana" })).toBeNull();
    expect(within(day(TODAY)).getByRole("button", { name: /09:00/ })).toBeInTheDocument();
  });

  it("moves by seven days and loads that week, without touching the URL", async () => {
    window.history.replaceState(null, "", "/inicio?estado=entregado&pagina=2");
    mocks.searchAppointments.mockResolvedValue(ok());
    renderHome(ok());

    fireEvent.click(screen.getByRole("button", { name: "7 días siguientes" }));

    const next = addDays(TODAY, 7);
    const range = visibleRange("week", next);
    await waitFor(() => expect(mocks.searchAppointments).toHaveBeenCalledWith(range.from, range.to));
    expect(window.location.search).toBe("?estado=entregado&pagina=2");
  });

  it("still creates an appointment from a day", async () => {
    renderHome(ok());
    fireEvent.click(screen.getByRole("button", { name: `Nuevo turno el ${formatIsoDate(addDays(TODAY, 2))}` }));
    expect(await screen.findByRole("heading", { name: "Nuevo turno" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Fecha/)).toHaveValue(addDays(TODAY, 2));
  });
});
