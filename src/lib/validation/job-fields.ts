import { z } from "zod";

// Reusable field rules for jobs. Error messages are keys under `validation` in
// messages/es.json; forms translate them.

// The database column is a 32-bit integer.
export const KILOMETERS_MAX = 2_147_483_647;

// Optional whole number of kilometers: dots and spaces are ignored (the input
// shows dot thousands), empty → null. The floor (the vehicle's previous jobs) is
// checked by the action and by the database, not here.
export const kilometersField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value, context) => {
    // A number is taken as it is; typed text may carry dot thousands.
    const text =
      value === null || value === undefined
        ? ""
        : typeof value === "number"
          ? String(value)
          : value.replace(/[.\s]/g, "");
    if (text === "") return null;
    const kilometers = /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isInteger(kilometers) || kilometers > KILOMETERS_MAX) {
      context.addIssue({ code: "custom", message: "kilometersInvalid" });
      return z.NEVER;
    }
    return kilometers;
  });

// A service quantity: a whole number, 1 or more.
export const quantityField = z
  .union([z.string(), z.number()], { error: "quantityInvalid" })
  .transform((value, context) => {
    const text = String(value).trim();
    const quantity = /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      context.addIssue({ code: "custom", message: "quantityInvalid" });
      return z.NEVER;
    }
    return quantity;
  });
