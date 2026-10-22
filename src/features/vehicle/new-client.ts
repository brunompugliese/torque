import { formatPhone } from "@/lib/format/phone";

export type TypedClient = { name: string; surname: string; phoneNumber: string };

const NUMBER_LIKE = /^[\d\s().+-]*\d[\d\s().+-]*$/;

// Text typed in the client dropdown before choosing "+ Crear cliente nuevo": a
// number goes to Teléfono, a name to Nombre (the first word) and Apellido (the
// rest). Nothing is carried over when the user picked a client from the list.
export function splitTypedClient(text: string): TypedClient {
  const typed = text.trim();
  if (!typed) return { name: "", surname: "", phoneNumber: "" };
  if (NUMBER_LIKE.test(typed)) return { name: "", surname: "", phoneNumber: formatPhone(typed) };
  const [name, ...rest] = typed.split(/\s+/);
  return { name, surname: rest.join(" "), phoneNumber: "" };
}
