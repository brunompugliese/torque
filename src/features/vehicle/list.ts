// List constants the browser needs. Kept apart from schemas.ts so the table
// doesn't pull Zod and the phone formatter into the page's first load.

// Column id (as in the URL) → sort key in vehicle_decrypted.
export const VEHICLE_SORT_COLUMNS = {
  patente: "plate",
  vehiculo: "vehicle_key",
  anio: "year",
  vin: "vin",
  cliente: "client_name_key",
  km: "last_km",
  creado: "created_at",
} as const;
export const VEHICLE_DEFAULT_SORT = "patente";
