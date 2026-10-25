"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import { parseListParams } from "@/lib/list/params";
import { isClosedStatus, isJobStatus, jobPhase } from "@/lib/status";
import { createServerSupabase } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/fields";

import { jobClientId, jobToFormState } from "./form";
import { JOB_FILTER_KEYS } from "./list";
import {
  getJobDetail,
  getJobListRow,
  getJobStatusCounts,
  getKmFloor,
  getVehicleOwner,
  listJobs,
  listServiceOptions,
  listVehicleJobs,
  type JobDetail,
  type JobPage,
  type JobRowResult,
  type JobStatusCounts,
  type KmFloor,
  type ServiceOptionList,
  type VehicleJobList,
  type VehicleOwnerResult,
} from "./queries";
import {
  JOB_LIST_COLUMNS,
  jobFormSchema,
  jobIdSchema,
  jobListRowSchema,
  toJobFieldErrors,
  type JobFormValues,
  type JobListItem,
} from "./schemas";
import { calculateTotals, fillFinalPrices } from "./total";

const JOBS_PATH = "/trabajos";
const VEHICLES_PATH = "/vehiculos";
const APPOINTMENTS_PATH = "/turnos";
const FOREIGN_KEY_VIOLATION = "23503";

export type JobErrorKey =
  | "invalid"
  | "closed"
  | "kmBelowPrevious"
  | "vehicleArchived"
  | "clientArchived"
  | "serviceArchived"
  | "notFound"
  | "unexpected";

export type JobActionResult = ActionResult<JobListItem, JobErrorKey>;

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>["supabase"];
type WriteError = { code?: string; message?: string };

// -----------------------------------------------------------------------------
// Read actions
// -----------------------------------------------------------------------------

// Read action for the vehicle modal: it loads the history when it opens.
export async function getVehicleJobs(vehicleId: unknown): Promise<VehicleJobList> {
  const id = idSchema.safeParse(vehicleId);
  if (!id.success) return { ok: false };
  return listVehicleJobs(id.data);
}

// The search text travels in the request body, never in a URL.
export async function searchJobs(listSearch: unknown): Promise<JobPage> {
  return listJobs(parseListParams(new URLSearchParams(typeof listSearch === "string" ? listSearch : ""), JOB_FILTER_KEYS));
}

// The Estado filter's counts for the same list state (the Estado selection is ignored).
export async function getStatusCounts(listSearch: unknown): Promise<JobStatusCounts> {
  return getJobStatusCounts(
    parseListParams(new URLSearchParams(typeof listSearch === "string" ? listSearch : ""), JOB_FILTER_KEYS),
  );
}

// A job as the list shows it, for a modal opened from a vehicle's history.
export async function getJobRow(id: unknown): Promise<JobRowResult> {
  const jobId = jobIdSchema.safeParse(id);
  if (!jobId.success) return { ok: false };
  return getJobListRow(jobId.data);
}

export async function getJobDetails(id: unknown): Promise<JobDetail> {
  const jobId = jobIdSchema.safeParse(id);
  if (!jobId.success) return { ok: false };
  return getJobDetail(jobId.data);
}

// The highest km already recorded for the vehicle (before the job, when editing).
export async function getVehicleKmFloor(vehicleId: unknown, jobId?: unknown): Promise<KmFloor> {
  const vehicle = idSchema.safeParse(vehicleId);
  const job = idSchema.nullish().safeParse(jobId);
  if (!vehicle.success || !job.success) return { ok: false };
  return getKmFloor(vehicle.data, job.data ?? undefined);
}

export async function getOwnerOfVehicle(vehicleId: unknown): Promise<VehicleOwnerResult> {
  const vehicle = idSchema.safeParse(vehicleId);
  if (!vehicle.success) return { ok: false };
  return getVehicleOwner(vehicle.data);
}

// `currentIds`: the services already on the job, kept even if archived since.
export async function getServiceOptions(currentIds?: unknown): Promise<ServiceOptionList> {
  const ids = z.array(idSchema).max(200).optional().safeParse(currentIds ?? undefined);
  if (!ids.success) return { ok: false };
  return listServiceOptions(ids.data);
}

// -----------------------------------------------------------------------------
// Writes
// -----------------------------------------------------------------------------

function unexpected(where: string, code?: string): JobActionResult {
  // Codes only: never log personal data.
  console.error(`[job] ${where} failed`, { code });
  return fail("unexpected");
}

function parseForm(input: unknown): { ok: true; data: JobFormValues } | { ok: false; result: JobActionResult } {
  const parsed = jobFormSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, result: fail("invalid", toJobFieldErrors(parsed.error)) };
}

// Writes return ciphertext (or nothing), so the saved job is read back through the list view.
async function readBack(supabase: Supabase, id: string): Promise<JobActionResult> {
  const { data, error } = await supabase.from("job_list").select(JOB_LIST_COLUMNS).eq("id", id).maybeSingle();
  if (error) return unexpected("read back", error.code);
  if (!data) return fail("notFound");
  revalidatePath(JOBS_PATH);
  // The vehicle's history and last km change with its jobs.
  revalidatePath(VEHICLES_PATH);
  // An appointment shows its job ("Ver trabajo" / "Crear trabajo").
  revalidatePath(APPOINTMENTS_PATH);
  return ok(jobListRowSchema.parse(data));
}

// Maps what the database says to what the form shows.
function writeFailure(error: WriteError): JobActionResult {
  switch (error.message) {
    case "job_closed":
      return fail("closed");
    case "job_kilometers_below_previous":
      return fail("kmBelowPrevious", { kilometers: "kmBelowPrevious" });
    case "vehicle_archived":
      return fail("vehicleArchived", { vehicleId: "vehicleArchived" });
    case "client_archived":
      return fail("clientArchived", { clientId: "clientArchived" });
    case "service_archived":
      return fail("serviceArchived");
    case "job_not_found":
    case "job_item_not_found":
      return fail("notFound");
  }
  // The composite foreign keys reject a vehicle, client, service or appointment of another shop.
  if (error.code === FOREIGN_KEY_VIOLATION) return fail("invalid");
  return unexpected("write", error.code);
}

// What an edit needs to know about the saved job: whether it is still open and
// whether its services already have final prices (a cancelled job keeps the
// phase it was in).
async function loadStoredJob(
  supabase: Supabase,
  jobId: string,
): Promise<{ ok: true; hadFinalPrices: boolean; clientId: string | null } | { ok: false; result: JobActionResult }> {
  const job = await supabase.from("job").select("id, status, client_id").eq("id", jobId).maybeSingle();
  if (job.error) return { ok: false, result: unexpected("job lookup", job.error.code) };
  if (!job.data) return { ok: false, result: fail("notFound") };
  // The database refuses to change a closed job; say so before doing any work.
  const status = String(job.data.status);
  if (isJobStatus(status) && isClosedStatus(status)) return { ok: false, result: fail("closed") };

  const items = await supabase.from("job_item").select("final_unit_price").eq("job_id", jobId);
  if (items.error) return { ok: false, result: unexpected("items lookup", items.error.code) };
  return {
    ok: true,
    hadFinalPrices: (items.data ?? []).some((item) => item.final_unit_price !== null),
    clientId: job.data.client_id ? String(job.data.client_id) : null,
  };
}

// One transaction in the database: the job, its services and its status together.
async function saveJob(jobId: string | null, input: unknown): Promise<JobActionResult> {
  const form = parseForm(input);
  if (!form.ok) return form.result;

  await requireSession();
  const { supabase } = await createServerSupabase();
  const values = form.data;

  let hadFinalPrices = false;
  let storedClientId: string | null = null;
  if (jobId) {
    const stored = await loadStoredJob(supabase, jobId);
    if (!stored.ok) return stored.result;
    hadFinalPrices = stored.hadFinalPrices;
    storedClientId = stored.clientId;
  }

  // The client is the vehicle's owner, or none: whatever the form says, it is decided here.
  const owner = await getVehicleOwner(values.vehicleId);
  if (!owner.ok) return unexpected("owner lookup");
  const clientId = jobClientId(owner.owner, storedClientId);

  // Final prices exist only in the work phase; there, an empty one is the quoted price.
  const phase = jobPhase(values.status, hadFinalPrices);
  const items = values.items.map((item) => ({
    ...item,
    finalUnitPrice: phase === "work" ? (item.finalUnitPrice ?? item.quotedUnitPrice) : null,
  }));
  const totals = calculateTotals(items, phase);

  const { data, error } = await supabase.rpc("save_job", {
    p_job_id: jobId,
    p_vehicle_id: values.vehicleId,
    p_client_id: clientId,
    p_status: values.status,
    p_kilometers: values.kilometers,
    p_appointment_id: values.appointmentId,
    p_observations: values.observations,
    p_quoted_total: totals.quoted,
    p_final_total: totals.final,
    p_items: items.map((item) => ({
      id: item.id,
      service_id: item.serviceId,
      quantity: item.quantity,
      quoted_unit_price: item.quotedUnitPrice,
      final_unit_price: item.finalUnitPrice,
    })),
    p_new_client: null,
  });
  if (error) return writeFailure(error);
  if (typeof data !== "string") return unexpected("function result");

  return readBack(supabase, data);
}

// Changes only the status, from the list or the modal's header: the same save as the form, with
// the saved job and services, so the phase rules, the history and the closing rules are the same.
export async function setJobStatus(id: unknown, status: unknown): Promise<JobActionResult> {
  const jobId = jobIdSchema.safeParse(id);
  if (!jobId.success) return fail("notFound");
  if (typeof status !== "string" || !isJobStatus(status)) return fail("invalid");

  const [row, detail] = await Promise.all([getJobListRow(jobId.data), getJobDetail(jobId.data)]);
  if (!row.ok || !detail.ok) return fail("notFound");
  // An archived job is restored before it changes (the list greys it out).
  if (!row.row.enabled) return fail("invalid");

  const form = jobToFormState(row.row, detail.items);
  // Into the work phase every service without a final price takes its quoted one, as the form does.
  const phase = jobPhase(status, detail.items.some((item) => item.finalUnitPrice !== null));
  return saveJob(jobId.data, { ...form, status, items: phase === "work" ? fillFinalPrices(form.items) : form.items });
}

export async function createJob(input: unknown): Promise<JobActionResult> {
  return saveJob(null, input);
}

export async function updateJob(id: unknown, input: unknown): Promise<JobActionResult> {
  const jobId = jobIdSchema.safeParse(id);
  if (!jobId.success) return fail("notFound");
  return saveJob(jobId.data, input);
}

// Archiving is allowed on closed jobs too: the database lets a closed job be
// archived and unarchived.
export async function setJobArchived(id: unknown, archived: boolean): Promise<JobActionResult> {
  const jobId = jobIdSchema.safeParse(id);
  if (!jobId.success) return fail("notFound");

  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("job")
    .update({ enabled: !archived })
    .eq("id", jobId.data)
    .select("id")
    .maybeSingle();
  if (error) return unexpected("archive", error.code);
  if (!data) return fail("notFound");

  return readBack(supabase, jobId.data);
}
