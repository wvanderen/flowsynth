// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { notificationPermission, playChime, showTargetNotification, unlockAudio } from "./signals";

// The signal channels (focus-tool spec §4–5) degrade to no-ops where the
// browser API is missing — happy-dom has neither Web Audio nor
// Notification, so these run the silent paths end to end.

describe("the signal channels degrade silently", () => {
  it("reports unsupported when Notification is missing", () => {
    expect(notificationPermission()).toBe("unsupported");
  });

  it("unlocks to null without AudioContext, and the chime no-ops", () => {
    expect(unlockAudio(null)).toBeNull();
    expect(() => playChime(null)).not.toThrow();
    expect(() => showTargetNotification(() => undefined)).not.toThrow();
  });
});
