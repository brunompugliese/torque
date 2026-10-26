"use server";

import { revalidatePath } from "next/cache";

import { createJob, type JobActionResult } from "@/features/job/actions";
import { getKmFloor, getVehicleOwner } from "@/features/job/queries";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import { addDays, parseIsoDay, WEEK_LENGTH } from "@/lib/calendar";
import { isAppointmentStatus } from "@/lib/status";
import { createServerSupabase } from "@/lib/supabase/server";

import { appointmentClientId } from "./form";
import { getAppointmentListRow, listAppointments, type AppointmentRange } from "./queries";
import {
  APPOINTMENT_LIST_COLUMNS,
  appointmentFormSchema,
  appointmentIdSchema,
  appointmentListRowSchema,
  toAppointmentFieldErrors,
  type AppointmentFormValues,
  type AppointmentListItem,
} from "./schemas";

const APPOINTMENTS_PATH = "/turnos";
const HOME_PATH = "/inicio";
const FOREIGN_KEY_VIOLATION = "23503";
// A month grid is at most six weeks; a bigger range is not a calendar's.
const MAX_RANGE_DAYS = WEEK_LENGTH * 9;

export type AppointmentErrorKey = "invalid" | "vehicleArchived" | "notFound" | "unexpected";

export type AppointmentActionResult = ActionResult<AppointmentListItem, AppointmentErrorKey>;

// Creating a job from an appointment: the job's own errors, plus the appointment being cancelled.
export type AppointmentJobResult = JobActionResult | ActionResult<never, "cancelled" | "notFound">;

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>["supabase"];
type WriteError = { code?: string; message?: string };

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

// The calendar loads the days it shows when the month or the week changes.
export async function searchAppointments(from: unknown, to: unknown): Promise<AppointmentRange> {
  const start = typeof from === "string" ? parseIsoDay(from) : null;
  const end = typeof to === "string" ? parseIsoDay(to) : null;
  if (!start || !end || start > end || end > addDays(start, MAX_RANGE_DAYS)) return { ok: false };
  return listAppointments(start, end);
}

// -----------------------------------------------------------------------------
// Writes
// -----------------------------------------------------------------------------

function unexpected(where: string, code?: string): AppointmentActionResult {
  // Codes only: never log personal data.
  console.error(`[appointment] ${where} failed`, { code });
  return fail("unexpected");
}

function parseForm(
  input: unknown,
): { ok: true; data: AppointmentFormValues } | { ok: false; result: AppointmentActionResult } {
  const parsed = appointmentFormSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, result: fail("invalid", toAppointmentFieldErrors(parsed.error)) };
}

// Writes return ciphertext (or nothing), so the saved row is read back through the list view.
async function readBack(supabase: Supabase, id: string): Promise<AppointmentActionResult> {
  const { data, error } = await supabase
    .from("appointment_list")
    .select(APPOINTMENT_LIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return unexpected("read back", error.code);
  if (!data) return fail("notFound");
  revalidatePath(APPOINTMENTS_PATH);
  // Inicio shows the coming week.
  revalidatePath(HOME_PATH);
  return ok(appointmentListRowSchema.parse(data));
}

// Maps what the database says to what the form shows.
function writeFailure(error: WriteError): AppointmentActionResult {
  if (error.message === "vehicle_archived") return fail("vehicleArchived", { vehicleId: "vehicleArchived" });
  // The composite foreign keys reject a vehicle or a client of another shop.
  if (error.code === FOREIGN_KEY_VIOLATION) return fail("invalid");
  return unexpected("write", error.code);
}

// The client is the vehicle's owner when the appointment is created; nobody picks it.
export async function createAppointment(input: unknown): Promise<AppointmentActionResult> {
  const form = parseForm(input);
  if (!form.ok) return form.result;

  const { shopId } = await requireSession();
  const { supabase } = await createServerSupabase();
  const values = form.data;

  const owner = await getVehicleOwner(values.vehicleId);
  if (!owner.ok) return unexpected("owner lookup");

  const { data, error } = await supabase
    .from("appointment")
    .insert({
      shop_id: shopId,
      vehicle_id: values.vehicleId,
      client_id: appointmentClientId(null, values.vehicleId, owner.owner?.id ?? null),
      date: values.date,
      time: values.time,
      reason: values.reason,
      status: "pendiente",
    })
    .select("id")
    .single();
  if (error) return writeFailure(error);
  if (!data) return unexpected("insert");

  return readBack(supabase, String(data.id));
}

export async function updateAppointment(id: unknown, input: unknown): Promise<AppointmentActionResult> {
  const appointmentId = appointmentIdSchema.safeParse(id);
  if (!appointmentId.success) return fail("notFound");
  const form = parseForm(input);
  if (!form.ok) return form.result;

  await requireSession();
  const { supabase } = await createServerSupabase();
  const values = form.data;

  const stored = await supabase
    .from("appointment")
    .select("vehicle_id, client_id")
    .eq("id", appointmentId.data)
    .maybeSingle();
  if (stored.error) return unexpected("lookup", stored.error.code);
  if (!stored.data) return fail("notFound");

  // The stored client stays while the vehicle does; another vehicle brings its own owner.
  const owner = await getVehicleOwner(values.vehicleId);
  if (!owner.ok) return unexpected("owner lookup");
  const clientId = appointmentClientId(
    {
      vehicleId: String(stored.data.vehicle_id),
      clientId: stored.data.client_id ? String(stored.data.client_id) : null,
    },
    values.vehicleId,
    owner.owner?.id ?? null,
  );

  const { data, error } = await supabase
    .from("appointment")
    .update({
      vehicle_id: values.vehicleId,
      client_id: clientId,
      date: values.date,
      time: values.time,
      reason: values.reason,
      status: values.status,
    })
    .eq("id", appointmentId.data)
    .select("id")
    .maybeSingle();
  if (error) return writeFailure(error);
  if (!data) return fail("notFound");

  return readBack(supabase, appointmentId.data);
}

// Confirm, complete, cancel or reactivate: only the status changes.
export async function setAppointmentStatus(id: unknown, status: unknown): Promise<AppointmentActionResult> {
  const appointmentId = appointmentIdSchema.safeParse(id);
  if (!appointmentId.success) return fail("notFound");
  if (typeof status !== "string" || !isAppointmentStatus(status)) return fail("invalid");

  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("appointment")
    .update({ status })
    .eq("id", appointmentId.data)
    .select("id")
    .maybeSingle();
  if (error) return writeFailure(error);
  if (!data) return fail("notFound");

  return readBack(supabase, appointmentId.data);
}

// "Crear trabajo": a job with what the appointment already knows, no form. The job's own server
// rules decide its client (the vehicle's owner, none if archived) and check its km against the
// vehicle's previous jobs; the km starts as the latest recorded one.
export async function createJobFromAppointment(id: unknown): Promise<AppointmentJobResult> {
  const appointmentId = appointmentIdSchema.safeParse(id);
  if (!appointmentId.success) return fail("notFound");

  const row = await getAppointmentListRow(appointmentId.data);
  if (!row.ok) return fail("notFound");
  const appointment = row.row;
  if (appointment.status === "cancelado") return fail("cancelled");
  if (!appointment.vehicle.enabled) return fail("vehicleArchived");

  const floor = await getKmFloor(appointment.vehicle.id);
  if (!floor.ok) {
    console.error("[appointment] km lookup failed");
    return fail("unexpected");
  }

  const result = await createJob({
    vehicleId: appointment.vehicle.id,
    status: "pendiente",
    kilometers: floor.floor,
    appointmentId: appointment.id,
    observations: appointment.reason,
    items: [],
  });
  if (result.ok) {
    revalidatePath(APPOINTMENTS_PATH);
    revalidatePath(HOME_PATH);
  }
  return result;
}
