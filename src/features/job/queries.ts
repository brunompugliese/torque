import "server-only";

import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

import { JOB_HISTORY_COLUMNS, jobRowSchema, type VehicleJob } from "./schemas";

export type VehicleJobList = { ok: true; rows: VehicleJob[] } | { ok: false };

// Every job of the vehicle, archived ones included, newest first. No page: the
// vehicle modal shows five and expands the rest in place.
export async function listVehicleJobs(vehicleId: string): Promise<VehicleJobList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("job")
    .select(JOB_HISTORY_COLUMNS)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    console.error("[job] vehicle jobs query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(jobRowSchema).parse(data ?? []) };
}
