import { getRequestConfig } from "next-intl/server";

// Spanish is the only UI language, so the locale is fixed and URLs carry no
// locale segment (see docs/architecture.md).
export const LOCALE = "es";

export default getRequestConfig(async () => ({
  locale: LOCALE,
  messages: (await import(`../../messages/${LOCALE}.json`)).default,
}));
