// List constants the browser needs. Kept apart from schemas.ts so the table
// doesn't pull Zod into the page's first load.

// Column id (as in the URL) → database column.
export const SERVICE_SORT_COLUMNS = { nombre: "name_key", creado: "created_at" } as const;
export const SERVICE_DEFAULT_SORT = "nombre";
