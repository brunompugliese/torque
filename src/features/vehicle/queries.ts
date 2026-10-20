import "server-only";

import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

import { VEHICLE_COLUMNS, vehicleRowSchema, type Vehicle } from "./schemas";

export type VehicleList = { ok: true; rows: Vehicle[] } | { ok: false };

function parseRows(data: unknown): VehicleList {
  return { ok: true, rows: z.array(vehicleRowSchema).parse(data ?? []) };
}

// No page and no search: the lists these feed are short and filtered in
// memory. Created order, with the id as tiebreak, keeps rows steady between
// loads.
export async function listClientVehicles(clientId: string): Promise<VehicleList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("vehicle_decrypted")
    .select(VEHICLE_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at")
    .order("id");
  if (error) {
    console.error("[vehicle] client vehicles query failed", { code: error.code });
    return { ok: false };
  }
  return parseRows(data);
}

export async function listUnassignedVehicles(): Promise<VehicleList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("vehicle_decrypted")
    .select(VEHICLE_COLUMNS)
    .is("client_id", null)
    .order("created_at")
    .order("id");
  if (error) {
    console.error("[vehicle] unassigned vehicles query failed", { code: error.code });
    return { ok: false };
  }
  return parseRows(data);
}
