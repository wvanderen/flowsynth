// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { CHIME, NAMED_CHORDS } from "../engine/constants";
import { STRUM, notificationPermission, playChime, playStrum, showTargetNotification, unlockAudio } from "./signals";
import type { NamedChordTerm } from "../engine/types";

// The signal channels (focus-tool spec §4–5; board-redesign spec §6)
// degrade to no-ops where the browser API is missing — happy-dom has
// neither Web Audio nor Notification, so these run the silent paths end
// to end, formation cue included. No flow ambient exists: an ambient
// soundscape would need to be designed on purpose.

const chord = (name: string, root: number): NamedChordTerm => ({ name, bonus: 0.3, instances: 1, moduleIds: [], root });

// A controllable audio context (issue #390): the adapter's schedule is
// observed through the starts and stops it books on this context, never
// through the adapter's own bookkeeping.
class FakeGainParam {
  setValueAtTime(): void {}
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeGain {
  gain = new FakeGainParam();
  connect(): unknown {
    return undefined;
  }
}

class FakeOscillator {
  type = "sine";
  frequency = { value: 0 };
  starts: number[] = [];
  stops: number[] = [];
  connect(): FakeGain {
    return new FakeGain();
  }
  start(when: number): void {
    this.starts.push(when);
  }
  stop(when: number): void {
    this.stops.push(when);
  }
}

class CueContext {
  currentTime = 0;
  state = "running";
  destination = {};
  oscillators: FakeOscillator[] = [];
  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
}

const cue = (name: string): NamedChordTerm => chord(name, 0);

describe("the signal channels degrade silently", () => {
  it("reports unsupported when Notification is missing", () => {
    expect(notificationPermission()).toBe("unsupported");
  });

  it("unlocks to null without AudioContext, and the chime no-ops", () => {
    expect(unlockAudio(null)).toBeNull();
    expect(() => playChime(null)).not.toThrow();
    expect(() => showTargetNotification(() => undefined)).not.toThrow();
  });

  it("the formation cue no-ops without an AudioContext", () => {
    expect(() => playStrum(null, cue("Fifth"))).not.toThrow();
  });

  it("the formation cue no-ops on a suspended context", () => {
    const ctx = new CueContext();
    ctx.state = "suspended";
    playStrum(ctx as unknown as AudioContext, cue("Fifth"));
    expect(ctx.oscillators).toHaveLength(0);
  });
});

describe("the strum's tuning (§6)", () => {
  it("the strum sits below the chime's register", () => {
    expect(STRUM.rootHz).toBe(CHIME.rootHz / 2);
  });
});

describe("the bounded formation cue (#390)", () => {
  it("every chord's whole schedule, tail included, stays inside the bound", () => {
    for (const def of NAMED_CHORDS) {
      const ctx = new CueContext();
      playStrum(ctx as unknown as AudioContext, cue(def.name));
      expect(ctx.oscillators.length).toBeGreaterThan(1);
      for (const osc of ctx.oscillators) {
        expect(osc.starts).toHaveLength(1);
        expect(osc.stops).toHaveLength(1);
        expect(osc.stops[0]! - ctx.currentTime).toBeLessThanOrEqual(STRUM.boundSeconds);
      }
      // The pluck climbs: each note starts at or after its predecessor.
      const starts = ctx.oscillators.map((osc) => osc.starts[0]!);
      expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    }
  });

  it("a later cue stops the unfinished one instead of queuing or overlapping", () => {
    const ctx = new CueContext();
    playStrum(ctx as unknown as AudioContext, cue("Fifth"));
    const first = ctx.oscillators.slice();
    ctx.currentTime = 0.4;
    playStrum(ctx as unknown as AudioContext, cue("Octave"));
    // The first cue's every note was stopped right at the replacement.
    for (const osc of first) {
      expect(osc.stops).toContain(0.4);
    }
    // The replacement schedules from the replacement moment onward.
    const second = ctx.oscillators.slice(first.length);
    expect(second.length).toBeGreaterThan(0);
    for (const osc of second) {
      expect(osc.starts[0]).toBeGreaterThanOrEqual(0.4);
    }
  });
});
