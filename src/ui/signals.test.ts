// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { CHIME } from "../engine/constants";
import { DRONE, STRUM, notificationPermission, playChime, playStrum, sessionDroneHz, showTargetNotification, startDrone, stopDrone, unlockAudio } from "./signals";
import type { NamedChordTerm } from "../engine/types";

// The signal channels (focus-tool spec §4–5; board-redesign spec §6)
// degrade to no-ops where the browser API is missing — happy-dom has
// neither Web Audio nor Notification, so these run the silent paths end
// to end, chord garnish included.

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

  it("the chord garnish no-ops without an AudioContext", () => {
    expect(() => playStrum(null, [chord("Fifth", 0)])).not.toThrow();
    expect(() => startDrone(null, DRONE.baseHz)).not.toThrow();
    expect(() => stopDrone()).not.toThrow();
  });
});

describe("the chord garnish's tuning (§6)", () => {
  it("the drone follows the first chord's root; chordless boards drone the bare root", () => {
    expect(sessionDroneHz([])).toBe(DRONE.baseHz);
    expect(sessionDroneHz([chord("Fifth", 7)])).toBeCloseTo(DRONE.baseHz * 2 ** (7 / 12), 9);
    expect(sessionDroneHz([chord("Fifth", 7), chord("Octave", 0)])).toBeCloseTo(DRONE.baseHz * 2 ** (7 / 12), 9);
  });

  it("the strum sits below the chime's register", () => {
    expect(STRUM.rootHz).toBe(CHIME.rootHz / 2);
    expect(DRONE.baseHz).toBe(CHIME.rootHz / 4);
  });
});
