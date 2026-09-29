// AES-256-GCM with Web Crypto, so it runs in both the proxy and Node runtimes.
// Output format: base64url(iv[12] || ciphertext || tag[16]).

const IV_LENGTH = 12;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

export function importAesKey(base64Secret: string): Promise<CryptoKey> {
  let key = keyCache.get(base64Secret);
  if (!key) {
    const raw = Uint8Array.from(atob(base64Secret), (char) => char.charCodeAt(0));
    key = crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    keyCache.set(base64Secret, key);
  }
  return key;
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv);
  out.set(ciphertext, iv.length);
  return toBase64Url(out);
}

// Returns null for anything that doesn't decrypt and authenticate: tampered
// data, a different key, or garbage.
export async function decrypt(key: CryptoKey, token: string): Promise<string | null> {
  try {
    const bytes = fromBase64Url(token);
    if (bytes.length <= IV_LENGTH) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, IV_LENGTH) },
      key,
      bytes.subarray(IV_LENGTH),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
