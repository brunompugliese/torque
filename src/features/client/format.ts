// "Nombre Apellido"; the surname is optional.
export function formatClientName({ name, surname }: { name: string; surname: string | null }): string {
  return surname ? `${name} ${surname}` : name;
}
