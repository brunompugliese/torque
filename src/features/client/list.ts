// List constants the browser needs. Kept apart from schemas.ts so the table
// doesn't pull Zod and the phone formatter into the page's first load.

// Column id (as in the URL) → sort key in client_decrypted.
export const CLIENT_SORT_COLUMNS = {
  cliente: "name_key",
  dni: "dni_number",
  telefono: "phone_key",
  email: "email_key",
  creado: "created_at",
} as const;
export const CLIENT_DEFAULT_SORT = "cliente";
