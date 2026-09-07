import { describe, expect, it } from "vitest";
import { messages, errorKey, UiError } from "../ui/src/messages.js";

describe("English interface errors", () => {
  it("preserves an actionable error code and its English message", () => {
    const error = new UiError("invalidReport");
    expect(errorKey(error)).toBe("invalidReport");
    expect(error.message).toBe(messages.en.invalidReport);
    expect(error.message).toContain("No verdict was accepted");
  });
  it("maps unexpected errors to safe connection copy", () => {
    const error = new Error("private server details");
    expect(errorKey(error)).toBe("network");
    expect(messages.en[errorKey(error)]).not.toContain(error.message);
  });
});
