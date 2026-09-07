import { messages } from "./messages.js";

export function useLocale() {
  return { locale: "en" as const, t: messages.en };
}
