import { formatClientName } from "@/features/client/format";
import type { Shop } from "@/features/shop/types";
import { formatDateTime } from "@/lib/format/date";
import { formatJobNumber } from "@/lib/format/job-number";
import { formatKm } from "@/lib/format/km";
import { formatPhone, phoneDigits, PHONE_DIGITS } from "@/lib/format/phone";
import { formatPlate } from "@/lib/format/plate";

import { formatJobVehicle } from "./format";
import type { JobItem, JobListItem } from "./schemas";

// What the printed sheet shows, ready to draw (spec 013). Missing values are null: the sheet puts
// its own text ("Sin cliente", "Sin cargar") there. No price and not the job's observations: the
// sheet is for writing by hand, and the clients sign what will be done.
export type JobSheet = {
  // "N° 000123"
  number: string;
  shop: { name: string | null; address: string | null; phone: string | null; hasLogo: boolean };
  // dd/mm/aaaa, Argentina time
  createdOn: string;
  printedOn: string;
  // "AB 123 CD"
  plate: string;
  // "Fiat Cronos 2021"
  vehicle: string;
  vin: string | null;
  client: string | null;
  clientPhone: string | null;
  kilometers: string | null;
  // In the order they were added to the job.
  services: { id: string; name: string; quantity: number }[];
};

// The owner types the shop's phone in the dashboard: Argentine numbers are spaced like the app's
// other phones, anything else is shown as typed.
function shopPhone(phone: string | null): string | null {
  if (!phone) return null;
  return phoneDigits(phone).length === PHONE_DIGITS ? formatPhone(phone) : phone;
}

// "27/10/2026 21:47" → "27/10/2026"
function dayOf(value: string | Date): string {
  return formatDateTime(value).slice(0, 10);
}

export function buildSheet(
  job: JobListItem,
  items: readonly JobItem[],
  shop: Shop | null,
  vin: string | null,
  now: Date,
): JobSheet {
  const phone = job.client?.phoneNumber.trim();
  return {
    number: formatJobNumber(job.number),
    shop: {
      name: shop?.name ?? null,
      address: shop?.address ?? null,
      phone: shopPhone(shop?.phone ?? null),
      hasLogo: shop?.hasLogo ?? false,
    },
    createdOn: dayOf(job.createdAt),
    printedOn: dayOf(now),
    plate: formatPlate(job.vehicle.plate),
    vehicle: formatJobVehicle(job),
    vin: vin?.trim() ? vin.trim() : null,
    client: job.client ? formatClientName(job.client) : null,
    clientPhone: phone ? phone : null,
    kilometers: job.kilometers === null ? null : formatKm(job.kilometers),
    services: items.map(({ id, serviceName, quantity }) => ({ id, name: serviceName, quantity })),
  };
}
