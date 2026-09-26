// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { CHIME } from "../engine/constants";
import { STRUM, notificationPermission, playChime, playStrum, showTargetNotification, unlockAudio } from "./signals";
import type { NamedChordTerm } from "../engine/types";

// The signal channels (focus-tool spec §4–5; board-redesign spec §6)
// degrade to no-ops where the browser API is missing — happy-dom has
// neither Web Audio nor Notification, so these run the silent paths end
// to end, formation strum included. No flow ambient exists: an ambient
// soundscape would need to be designed on purpose.

const chord = (name: string, root: number): NamedChordTerm => ({ name, bonus: 0.3, instances: 1, moduleIds: [], root });

describe("the signal channels degrade silently", () => {
  it("reports unsupported when Notification is missing", () => {
    expect(notificationPermission()).toBe("unsupported");
  });

  it("unlocks to null without AudioContext, and the chime no-ops", () => {
    expect(unlockAudio(null)).toBeNull();
    expect(() => playChime(null)).not.toThrow();
    expect(() => showTargetNotification(() => undefined)).not.toThrow();
  });

  it("the formation strum no-ops without an AudioContext", () => {
    expect(() => playStrum(null, [chord("Fifth", 0)])).not.toThrow();
  });
});

describe("the strum's tuning (§6)", () => {
  it("the strum sits below the chime's register", () => {
    expect(STRUM.rootHz).toBe(CHIME.rootHz / 2);
  });
});

