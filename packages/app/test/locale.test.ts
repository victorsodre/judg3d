import { describe, expect, it } from "vitest";
import {
  messages,
  resolveLocale,
  translate,
  errorKey,
  UiError,
} from "../ui/src/messages.js";

describe("interface language", () => {
  it("uses English until Brazilian Portuguese is explicitly selected", () => {
    for (const value of [null, undefined, "", "pt", "fr", "invalid"])
      expect(resolveLocale(value)).toBe("en");
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
  });
  it("has matching translation keys and localizes an existing error", () => {
    expect(Object.keys(messages.en).sort()).toEqual(
      Object.keys(messages["pt-BR"]).sort(),
    );
    const key = errorKey(new UiError("cancelled"));
    expect(translate("en")[key]).toContain("Analysis cancelled");
    expect(translate("pt-BR")[key]).toContain("Análise cancelada");
  });
});
