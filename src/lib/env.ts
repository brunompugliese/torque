import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_ANON_KEY: z.string().min(20),
  SESSION_COOKIE_SECRET: z
    .string()
    .refine((value) => decodedLength(value) === 32, "must be 32 bytes, base64"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function decodedLength(base64: string): number {
  try {
    return Buffer.from(base64, "base64").length;
  } catch {
    return 0;
  }
}

// Parsed on first use rather than at import time, so `next build` and CI
// don't need the variables. Error messages name the variables but never
// include their values.
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment variables. ${problems}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
