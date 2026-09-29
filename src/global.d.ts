import type messages from "../messages/es.json";

// Type-checks translation keys against messages/es.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: "es";
    Messages: typeof messages;
  }
}
