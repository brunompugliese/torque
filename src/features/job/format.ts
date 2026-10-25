import { formatPlate } from "@/lib/format/plate";

import type { JobListItem } from "./schemas";

// "AE 482 KD, Fiat Cronos": what a toast says about a job.
export function formatJobLabel({ vehicle }: Pick<JobListItem, "vehicle">): string {
  return `${formatPlate(vehicle.plate)}, ${vehicle.brandName} ${vehicle.modelName}`;
}

// "Fiat Cronos 2021", or "Fiat Cronos" without a year.
export function formatJobVehicle({ vehicle }: Pick<JobListItem, "vehicle">): string {
  return [vehicle.brandName, vehicle.modelName, vehicle.year].filter((part) => part !== null).join(" ");
}
