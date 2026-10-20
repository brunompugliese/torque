"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

import { listClientVehicles, listUnassignedVehicles, type VehicleList } from "./queries";
import { clientIdSchema, vehicleIdsSchema } from "./schemas";

const VEHICLES_PATH = "/vehiculos";
const FOREIGN_KEY_VIOLATION = "23503";

export type AssignErrorKey = "invalid" | "alreadyAssigned" | "notFound" | "unexpected";

export type AssignResult = ActionResult<{ assigned: string[]; skipped: number }, AssignErrorKey>;

// Read actions for the client modal: it loads these when it opens.
export async function getClientVehicles(clientId: unknown): Promise<VehicleList> {
  const id = clientIdSchema.safeParse(clientId);
  if (!id.success) return { ok: false };
  return listClientVehicles(id.data);
}

export async function getUnassignedVehicles(): Promise<VehicleList> {
  return listUnassignedVehicles();
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
