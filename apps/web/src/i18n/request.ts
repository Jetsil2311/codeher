import { getRequestConfig } from "next-intl/server";
import { messages } from "./messages";

// Single es-MX locale (tech spec section 2). The catalog lives in /messages/es/*.json.
export default getRequestConfig(async () => ({
  locale: "es",
  timeZone: "America/Mexico_City",
  messages,
  formats: {
    dateTime: {
      short: { day: "numeric", month: "short", year: "numeric" },
      long: { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" },
    },
  },
}));
