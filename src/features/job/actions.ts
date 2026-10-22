"use server";

import { idSchema } from "@/lib/validation/fields";

import { listVehicleJobs, type VehicleJobList } from "./queries";

// Read action for the vehicle modal: it loads the history when it opens.
export async function getVehicleJobs(vehicleId: unknown): Promise<VehicleJobList> {
  const id = idSchema.safeParse(vehicleId);
  if (!id.success) return { ok: false };
  return listVehicleJobs(id.data);
}
