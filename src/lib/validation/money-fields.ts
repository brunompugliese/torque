import { z } from "zod";

// Reusable money rule. Error messages are keys under `validation` in messages/es.json.

// What the price inputs accept: digits and one comma with up to two decimals
// ("12500,50"); whole amounts need no decimals (docs/design.md#copy-and-naming).
const MONEY_TEXT = /^\d+(,\d{1,2})?$/;

// The number the text stands for, or null when it isn't a valid amount.
export function parseMoney(text: string): number | null {
  const value = text.trim();
  if (!MONEY_TEXT.test(value)) return null;
  return Number(value.replace(",", "."));
}

// An amount as the input shows it: a comma for decimals, no thousands dots.
export function moneyInputText(amount: number): string {
  return String(amount).replace(".", ",");
}

// A price typed in a form (or sent to the server): empty → priceRequired,
// anything but digits and a decimal comma → priceInvalid. Zero is allowed
// (warranty or courtesy work). Numbers are accepted too, for values that come
// from the database.
export const moneyField = z
  .union([z.string(), z.number()], { error: "priceRequired" })
  .transform((value, context) => {
    const text = typeof value === "number" ? moneyInputText(value) : value.trim();
    if (text === "") {
      context.addIssue({ code: "custom", message: "priceRequired" });
      return z.NEVER;
    }
    const amount = parseMoney(text);
    if (amount === null) {
      context.addIssue({ code: "custom", message: "priceInvalid" });
      return z.NEVER;
    }
    return amount;
  });
