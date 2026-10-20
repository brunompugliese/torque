import type { CookieMethodsServer } from "@supabase/ssr";

import { decrypt, encrypt } from "@/lib/crypto/aes-gcm";

import { SESSION_MAX_AGE_SECONDS } from "./inactivity";

// The browser only ever sees `torque-session.<n>` cookies holding ciphertext.
// Inside them is a small "jar": the cookies @supabase/ssr wants to store
// (tokens) plus the app's last-activity stamp. See specs/002-login/design.md.

export const SESSION_COOKIE_NAME = "torque-session";
export const SUPABASE_STORAGE_KEY = "torque-auth";

// Browsers cap a cookie at 4096 bytes including name and attributes.
export const MAX_CHUNK_LENGTH = 3500;

const CHUNK_NAME = new RegExp(`^${SESSION_COOKIE_NAME}\\.(\\d+)$`);

type Jar = {
  cookies: Record<string, string>;
  lastSeenAt: number | null;
};

export type PhysicalCookie = { name: string; value: string };

export type CookieWrite = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  };
};

export type SessionStore = {
  readonly lastSeenAt: number | null;
  supabaseCookies: CookieMethodsServer;
  touch(now: number): void;
  clear(): void;
  // Cookie writes (and deletions, maxAge 0) needed to persist the jar, or an
  // empty list when nothing changed.
  commit(): Promise<CookieWrite[]>;
  // Headers @supabase/ssr asks for when auth cookies change (no-store caching).
  readonly responseHeaders: Record<string, string>;
};

const EMPTY_JAR: Jar = { cookies: {}, lastSeenAt: null };

function chunkIndexes(cookies: PhysicalCookie[]): number[] {
  return cookies
    .map(({ name }) => CHUNK_NAME.exec(name)?.[1])
    .filter((index): index is string => index !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

async function readJar(cookies: PhysicalCookie[], key: CryptoKey): Promise<Jar> {
  const byName = new Map(cookies.map((cookie) => [cookie.name, cookie.value]));
  const indexes = chunkIndexes(cookies);
  // Chunks must be 0..n-1 with no gaps; anything else is a partial write.
  if (indexes.length === 0 || indexes.some((index, position) => index !== position)) {
    return EMPTY_JAR;
  }
  const token = indexes.map((index) => byName.get(`${SESSION_COOKIE_NAME}.${index}`)).join("");
  const plaintext = await decrypt(key, token);
  if (plaintext === null) return EMPTY_JAR;

  try {
    const parsed: unknown = JSON.parse(plaintext);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "cookies" in parsed &&
      typeof parsed.cookies === "object" &&
      parsed.cookies !== null &&
      "lastSeenAt" in parsed &&
      (typeof parsed.lastSeenAt === "number" || parsed.lastSeenAt === null)
    ) {
      const entries = Object.entries(parsed.cookies).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      );
      return { cookies: Object.fromEntries(entries), lastSeenAt: parsed.lastSeenAt };
    }
  } catch {
    // Fall through: unreadable content means no session.
  }
  return EMPTY_JAR;
}

export function splitIntoChunks(value: string, size = MAX_CHUNK_LENGTH): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks;
}

export async function createSessionStore(options: {
  cookies: PhysicalCookie[];
  key: CryptoKey;
  secure: boolean;
}): Promise<SessionStore> {
  const { key, secure } = options;
  const existingChunks = chunkIndexes(options.cookies);
  const jar = await readJar(options.cookies, key);
  let current: Jar = { cookies: { ...jar.cookies }, lastSeenAt: jar.lastSeenAt };
  let dirty = false;
  const responseHeaders: Record<string, string> = {};

  const cookieOptions = (maxAge: number): CookieWrite["options"] => ({
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return {
    get lastSeenAt() {
      return current.lastSeenAt;
    },
    responseHeaders,
    supabaseCookies: {
      // Tokens only: the user object isn't needed in the cookie and would
      // make it bigger.
      encode: "tokens-only",
      getAll: () => Object.entries(current.cookies).map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value, options: setOptions } of cookiesToSet) {
          if (!value || setOptions?.maxAge === 0) {
            delete current.cookies[name];
          } else {
            current.cookies[name] = value;
          }
        }
        Object.assign(responseHeaders, headers);
        dirty = true;
      },
    },
    touch(now) {
      current.lastSeenAt = now;
      dirty = true;
    },
    clear() {
      current = { cookies: {}, lastSeenAt: null };
      dirty = true;
    },
    async commit() {
      if (!dirty) return [];
      dirty = false;

      const hasSession = Object.keys(current.cookies).length > 0;
      const chunks = hasSession ? splitIntoChunks(await encrypt(key, JSON.stringify(current))) : [];

      const writes: CookieWrite[] = chunks.map((value, index) => ({
        name: `${SESSION_COOKIE_NAME}.${index}`,
        value,
        options: cookieOptions(SESSION_MAX_AGE_SECONDS),
      }));
      // Delete chunks from the previous write that this one doesn't reuse.
      for (const index of existingChunks) {
        if (index >= chunks.length) {
          writes.push({
            name: `${SESSION_COOKIE_NAME}.${index}`,
            value: "",
            options: cookieOptions(0),
          });
        }
      }
      return writes;
    },
  };
}
