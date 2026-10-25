import { z } from "zod";

import { maxVehicleYear } from "@/lib/format/date";
import { PLATE_MAX_LENGTH, PLATE_MIN_LENGTH, plateCharacters } from "@/lib/format/plate";
import { VIN_LENGTH } from "@/lib/format/vin";

// Reusable field rules for vehicles. Error messages are keys under `validation`
// in messages/es.json; forms translate them.

// Stored the way the database stores it: uppercase, no spaces. 6 letters and
// digits (old format) or 7 (Mercosur); no further shape is checked.
export const plateField = z
  .string({ error: "plateRequired" })
  .transform(plateCharacters)
  .pipe(
    z
      .string()
      .min(1, { error: "plateRequired" })
      .min(PLATE_MIN_LENGTH, { error: "plateInvalid" })
      .max(PLATE_MAX_LENGTH, { error: "plateInvalid" }),
  );

export const VEHICLE_MIN_YEAR = 1886;

// Optional whole number from 1886 to next year. The upper bound is read when the
// value is checked, so a long-running server doesn't keep an old year.
export const yearField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value, context) => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (text === "") return null;
    const year = /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isInteger(year) || year < VEHICLE_MIN_YEAR || year > maxVehicleYear()) {
      context.addIssue({ code: "custom", message: "yearInvalid" });
      return z.NEVER;
    }
    return year;
  });

const VIN_FORMAT = new RegExp(`^[A-HJ-NPR-Z0-9]{${VIN_LENGTH}}$`);

// Trimmed, hyphens removed, uppercase; empty → null. Exactly 17 letters and
// digits, never I, O or Q. Not unique (several records can share a VIN).
export const vinField = z
  .string()
  .nullish()
  .transform((value) => (value ?? "").trim().replace(/-/g, "").toUpperCase())
  .refine((value) => value === "" || VIN_FORMAT.test(value), { error: "vinInvalid" })
  .transform((value) => (value === "" ? null : value));
