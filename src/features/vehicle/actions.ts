"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import { findByKey } from "@/lib/data/lookups";
import { parseListParams } from "@/lib/list/params";
import { createServerSupabase } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/fields";

import {
  listBrandOptions,
  listClientVehicles,
  listModelOptions,
  listUnassignedVehicles,
  listVehicleOptions,
  listVehicles,
  type CatalogOptionList,
  type ClientVehicleList,
  type VehicleList,
  type VehicleOptionList,
  type VehiclePage,
} from "./queries";
import {
  VEHICLE_LIST_COLUMNS,
  clientIdSchema,
  toVehicleFieldErrors,
  vehicleFormSchema,
  vehicleIdSchema,
  vehicleIdsSchema,
  vehicleListRowSchema,
  type VehicleField,
  type VehicleFormValues,
  type VehicleListItem,
} from "./schemas";

const VEHICLES_PATH = "/vehiculos";
const CLIENTS_PATH = "/clientes";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const OPTION_TERM_MAX_LENGTH = 100;

// What save_vehicle_with_new_client raises (docs/db_schema.sql).
const PLATE_TAKEN = "vehicle_plate_taken";
const DNI_TAKEN = "client_dni_taken";
const VEHICLE_NOT_FOUND = "vehicle_not_found";

export type AssignErrorKey = "invalid" | "alreadyAssigned" | "notFound" | "unexpected";

export type AssignResult = ActionResult<{ assigned: string[]; skipped: number }, AssignErrorKey>;

export type VehicleErrorKey =
  | "invalid"
  | "plateTaken"
  | "plateTakenArchived"
  | "dniTaken"
  | "dniTakenArchived"
  | "notFound"
  | "unexpected";

export type VehicleActionResult = ActionResult<VehicleListItem, VehicleErrorKey, VehicleField>;

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>["supabase"];
type WriteError = { code?: string; message?: string };

// Read actions for the client modal: it loads these when it opens.
export async function getClientVehicles(clientId: unknown): Promise<ClientVehicleList> {
  const id = clientIdSchema.safeParse(clientId);
  if (!id.success) return { ok: false };
  return listClientVehicles(id.data);
}

export async function getUnassignedVehicles(): Promise<VehicleList> {
  return listUnassignedVehicles();
}

// Read actions for the vehicle form's brand and model dropdowns. `currentId` is
// the brand or model the vehicle already has, kept even if it was archived.
export async function getBrandOptions(currentId?: unknown): Promise<CatalogOptionList> {
  const id = idSchema.nullish().safeParse(currentId);
  if (!id.success) return { ok: false };
  return listBrandOptions(id.data ?? undefined);
}

export async function getModelOptions(brandId: unknown, currentId?: unknown): Promise<CatalogOptionList> {
  const brand = idSchema.safeParse(brandId);
  const current = idSchema.nullish().safeParse(currentId);
  if (!brand.success || !current.success) return { ok: false };
  return listModelOptions(brand.data, current.data ?? undefined);
}

// The vehicle dropdown of the job and appointment forms. The term travels in the request body, never
// in a URL; `currentId` is the record's own vehicle, kept even if archived.
export async function searchVehicleOptions(term: unknown, currentId?: unknown): Promise<VehicleOptionList> {
  const current = idSchema.nullish().safeParse(currentId);
  if (typeof term !== "string" || !current.success) return { ok: false };
  return listVehicleOptions(term.slice(0, OPTION_TERM_MAX_LENGTH), current.data ?? undefined);
}

// One statement. The "client_id is null" guard leaves untouched any vehicle
// that got a client in the meantime; RLS keeps it inside the shop. An archived
// client is a valid owner, so there is no check on it.
export async function assignVehiclesToClient(clientId: unknown, vehicleIds: unknown): Promise<AssignResult> {
  const client = clientIdSchema.safeParse(clientId);
  const vehicles = vehicleIdsSchema.safeParse(vehicleIds);
  if (!client.success || !vehicles.success) return fail("invalid");

  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("vehicle")
    .update({ client_id: client.data })
    .in("id", vehicles.data)
    .is("client_id", null)
    .select("id");
  if (error) {
    console.error("[vehicle] assign failed", { code: error.code });
    // The composite foreign key rejects a client that isn't in the shop.
    return fail(error.code === FOREIGN_KEY_VIOLATION ? "notFound" : "unexpected");
  }

  const assigned = (data ?? []).map((row) => String(row.id));
  if (assigned.length === 0) return fail("alreadyAssigned");

  revalidatePath(VEHICLES_PATH);
  return ok({ assigned, skipped: vehicles.data.length - assigned.length });
}

function unexpected(where: string, code?: string): VehicleActionResult {
  // Codes only: never log personal data.
  console.error(`[vehicle] ${where} failed`, { code });
  return fail("unexpected");
}

function parseForm(
  input: unknown,
): { ok: true; data: VehicleFormValues } | { ok: false; result: VehicleActionResult } {
  const parsed = vehicleFormSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, result: fail("invalid", toVehicleFieldErrors(parsed.error)) };
}

// Writes return ciphertext, so the saved vehicle is read back through the view.
async function readBack(supabase: Supabase, id: string, clientCreated = false): Promise<VehicleActionResult> {
  const { data, error } = await supabase
    .from("vehicle_decrypted")
    .select(VEHICLE_LIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return unexpected("read back", error.code);
  if (!data) return fail("notFound");
  revalidatePath(VEHICLES_PATH);
  // A new client changes the clients page's summary.
  if (clientCreated) revalidatePath(CLIENTS_PATH);
  return ok(vehicleListRowSchema.parse(data));
}

// The database refused a duplicate plate: find out whose it is to say whether
// that vehicle is archived (docs/design.md#uniqueness-per-shop).
async function plateClash(supabase: Supabase, plate: string, excludeId?: string): Promise<VehicleActionResult> {
  try {
    const match = await findByKey(supabase, { table: "vehicle_decrypted", column: "plate", key: plate, excludeId });
    if (!match) return unexpected("duplicate plate not found");
    const error = match.enabled ? "plateTaken" : "plateTakenArchived";
    return fail(error, { plate: error });
  } catch {
    return unexpected("plate lookup");
  }
}

async function dniClash(supabase: Supabase, dni: string | null): Promise<VehicleActionResult> {
  if (!dni) return unexpected("duplicate without a DNI");
  try {
    const match = await findByKey(supabase, { table: "client_decrypted", column: "dni", key: dni });
    if (!match) return unexpected("duplicate DNI not found");
    const error = match.enabled ? "dniTaken" : "dniTakenArchived";
    return fail(error, { "newClient.dni": error });
  } catch {
    return unexpected("dni lookup");
  }
}

// Maps what the database says to what the form shows. `viaFunction` is true
// when the write went through save_vehicle_with_new_client, which names the
// clash in its message; a direct vehicle write can only clash on the plate.
async function writeFailure(
  supabase: Supabase,
  error: WriteError,
  values: VehicleFormValues,
  options: { viaFunction: boolean; vehicleId?: string },
): Promise<VehicleActionResult> {
  if (error.message === VEHICLE_NOT_FOUND) return fail("notFound");
  if (error.message === DNI_TAKEN) return dniClash(supabase, values.newClient?.dni ?? null);
  if (error.message === PLATE_TAKEN || (!options.viaFunction && error.code === UNIQUE_VIOLATION)) {
    return plateClash(supabase, values.plate, options.vehicleId);
  }
  // The composite foreign keys reject a brand and model that don't go together
  // or a client of another shop.
  if (error.code === FOREIGN_KEY_VIOLATION) return fail("invalid");
  return unexpected("write", error.code);
}

// With a new client the client and the vehicle are saved by one database
// function, in one transaction: if either fails, neither is saved.
async function saveWithNewClient(
  supabase: Supabase,
  values: VehicleFormValues,
  vehicleId?: string,
): Promise<VehicleActionResult> {
  const { newClient } = values;
  if (!newClient) return fail("invalid");

  const { data, error } = await supabase.rpc("save_vehicle_with_new_client", {
    p_vehicle_id: vehicleId ?? null,
    p_plate: values.plate,
    p_brand_id: values.brandId,
    p_model_id: values.modelId,
    p_year: values.year,
    p_vin: values.vin,
    p_name: newClient.name,
    p_surname: newClient.surname,
    p_phone_number: newClient.phoneNumber,
    p_dni: newClient.dni,
  });
  if (error) return writeFailure(supabase, error, values, { viaFunction: true, vehicleId });
  if (typeof data !== "string") return unexpected("function result");

  return readBack(supabase, data, true);
}

export async function createVehicle(input: unknown): Promise<VehicleActionResult> {
  const form = parseForm(input);
  if (!form.ok) return form.result;

  const { shopId } = await requireSession();
  const { supabase } = await createServerSupabase();
  const values = form.data;

  if (values.newClient) return saveWithNewClient(supabase, values);

  const { data, error } = await supabase
    .from("vehicle")
    .insert({
      shop_id: shopId,
      client_id: values.clientId,
      plate: values.plate,
      brand_id: values.brandId,
      model_id: values.modelId,
      year: values.year,
      vin: values.vin,
    })
    .select("id")
    .single();
  if (error) return writeFailure(supabase, error, values, { viaFunction: false });
  if (!data) return unexpected("insert");

  return readBack(supabase, String(data.id));
}

export async function updateVehicle(id: unknown, input: unknown): Promise<VehicleActionResult> {
  const vehicleId = vehicleIdSchema.safeParse(id);
  if (!vehicleId.success) return fail("notFound");
  const form = parseForm(input);
  if (!form.ok) return form.result;

  await requireSession();
  const { supabase } = await createServerSupabase();
  const values = form.data;

  if (values.newClient) return saveWithNewClient(supabase, values, vehicleId.data);

  const { data, error } = await supabase
    .from("vehicle")
    .update({
      client_id: values.clientId,
      plate: values.plate,
      brand_id: values.brandId,
      model_id: values.modelId,
      year: values.year,
      vin: values.vin,
    })
    .eq("id", vehicleId.data)
    .select("id")
    .maybeSingle();
  if (error) return writeFailure(supabase, error, values, { viaFunction: false, vehicleId: vehicleId.data });
  if (!data) return fail("notFound");

  return readBack(supabase, vehicleId.data);
}

export async function setVehicleArchived(id: unknown, archived: boolean): Promise<VehicleActionResult> {
  const vehicleId = vehicleIdSchema.safeParse(id);
  if (!vehicleId.success) return fail("notFound");

  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("vehicle")
    .update({ enabled: !archived })
    .eq("id", vehicleId.data)
    .select("id")
    .maybeSingle();
  if (error) return unexpected("archive", error.code);
  if (!data) return fail("notFound");

  return readBack(supabase, vehicleId.data);
}

// The search text travels in the request body, never in a URL.
export async function searchVehicles(listSearch: unknown): Promise<VehiclePage> {
  const params = parseListParams(new URLSearchParams(typeof listSearch === "string" ? listSearch : ""));
  return listVehicles(params);
}
