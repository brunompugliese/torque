import { formatThousands } from "./number";

// Pesos with dot thousands; decimals (a comma, always two) only when the amount
// has them: "$ 605.000" · "$ 12.500,50" (docs/design.md#copy-and-naming).
export function formatMoney(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  const sign = amount < 0 && cents > 0 ? "-" : "";
  const decimals = fraction === 0 ? "" : `,${String(fraction).padStart(2, "0")}`;
  return `${sign}$ ${formatThousands(String(whole))}${decimals}`;
}

// What a price input keeps while the user types or pastes: digits and one comma
// with up to two decimals ("12500,50"). A dot is dropped, not turned into a
// comma: a pasted "12.500" must not become twelve and a half.
export function formatMoneyInput(input: string): string {
  const cleaned = input.replace(/[^\d,]/g, "");
  const comma = cleaned.indexOf(",");
  if (comma === -1) return cleaned;
  const whole = cleaned.slice(0, comma);
  const decimals = cleaned.slice(comma + 1).replace(/,/g, "").slice(0, 2);
  return `${whole},${decimals}`;
}
