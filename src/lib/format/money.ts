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
