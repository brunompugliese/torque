// DNI is stored as digits only; shown with dot thousands (docs/design.md#copy-and-naming).
export function formatDni(dni: string): string {
  return dni.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
