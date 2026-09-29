import { describe, expect, it } from "vitest";

import { mapAuthError } from "./errors";

describe("mapAuthError", () => {
  it.each(["invalid_credentials", "user_not_found", "user_banned", "email_not_confirmed"])(
    "hides %s behind the same invalid-credentials message",
    (code) => {
      expect(mapAuthError({ code, status: 400 })).toBe("invalidCredentials");
    },
  );

  it.each([
    [{ code: "over_request_rate_limit", status: 429 }],
    [{ code: "over_email_send_rate_limit" }],
    [{ status: 429 }],
  ])("maps rate limits (%j)", (error) => {
    expect(mapAuthError(error)).toBe("rateLimited");
  });

  it.each([[{ code: "unexpected_failure", status: 500 }], [{}], [{ code: "session_not_found" }]])(
    "maps anything else to unexpected (%j)",
    (error) => {
      expect(mapAuthError(error)).toBe("unexpected");
    },
  );
});
