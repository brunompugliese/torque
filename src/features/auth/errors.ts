export type AuthErrorKey = "invalidCredentials" | "rateLimited" | "accountUnavailable" | "unexpected";

// Wrong password, unknown email, disabled (banned) profile and unconfirmed
// email must look identical, or the form would reveal which accounts exist.
const INVALID_CREDENTIALS_CODES = new Set([
  "invalid_credentials",
  "user_not_found",
  "user_banned",
  "email_not_confirmed",
]);

const RATE_LIMIT_CODES = new Set(["over_request_rate_limit", "over_email_send_rate_limit"]);

export function mapAuthError(error: { code?: string; status?: number }): AuthErrorKey {
  if (error.code && INVALID_CREDENTIALS_CODES.has(error.code)) return "invalidCredentials";
  if ((error.code && RATE_LIMIT_CODES.has(error.code)) || error.status === 429) {
    return "rateLimited";
  }
  return "unexpected";
}
