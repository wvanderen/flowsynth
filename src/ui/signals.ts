import { CHIME, NAMED_CHORDS } from "../engine/constants";
import type { NamedChordTerm } from "../engine/types";

// The signal channels (focus-tool spec §4–5; board-redesign spec §6): the
// synthesized just-intonation chime, the chord garnish — a flow drone plus
// a formation strum — and the silent non-persistent notification. Every
// function degrades to a no-op where the browser API is missing — denial
// and absence are silent by design, and tests run without either.

export type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported";

// The seams App fires its signals through; tests inject recorders, the
// browser build uses browserChannels.
export interface SignalChannels {
  unlockAudio(existing: AudioContext | null): AudioContext | null;
  playChime(ctx: AudioContext | null): void;
  playStrum(ctx: AudioContext | null, chords: readonly NamedChordTerm[]): void;
  startDrone(ctx: AudioContext | null, hz: number): void;
  stopDrone(): void;
  notificationPermission(): NotificationPermissionState;
  requestNotificationPermission(): void;
  showTargetNotification(onFocus: () => void): void;
}

// The session's AudioContext is created/resumed inside the start-session
// gesture (§10: a context born outside a gesture is born suspended). Null
// where Web Audio is unavailable — the chime then stays silent, and the
// title and notification carry the signal alone.
export function unlockAudio(existing: AudioContext | null): AudioContext | null {
  try {
    if (typeof AudioContext === "undefined") return null;
    const ctx = existing ?? new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// One just-intonation two-note motif: root then fifth (2:3, the chord
// vocabulary's Fifth), each note a sine with a quiet 3× partial from the
// same ratio ladder the board's chords sing. No assets, no dependencies.
export function playChime(ctx: AudioContext | null): void {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const notes = [CHIME.rootHz, CHIME.rootHz * CHIME.fifthRatio];
  const partials = [
    [1, CHIME.gain],
    [3, CHIME.partialGain],
  ] as const;
  notes.forEach((hz, note) => {
    const start = now + note * CHIME.onsetGapSeconds;
    for (const [ratio, gain] of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz * ratio;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(gain, start + CHIME.attackSeconds);
      env.gain.exponentialRampToValueAtTime(0.0001, start + CHIME.noteSeconds);
      osc.connect(env).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + CHIME.noteSeconds + 0.05);
    }
  });
}

export function notificationPermission(): NotificationPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/* ── The chord garnish (§6): strum + drone ──────────── */

// Just-intonation ratios for the launch chord vocabulary's interval classes
// (mod 12): unison, minor and major third, fifth, flat seventh. The
// fallbacks cover the cases the launch vocabulary never asks: an interval
// class outside the table lands on the tempered fifth, a chord name
// outside NAMED_CHORDS sings a bare fifth.
const JUST_RATIOS: Record<number, number> = { 0: 1, 3: 6 / 5, 4: 5 / 4, 7: 3 / 2, 10: 9 / 5 };
const TEMPERED_FIFTH_FALLBACK = 1.4983;
const FALLBACK_INTERVALS = [0, 7];

// The chord garnish's tuning (§6: garnish — no further sound-design work).
export const STRUM = {
  // The strum's root sits an octave below the chime's, so the two never
  // crowd each other.
  rootHz: CHIME.rootHz / 2,
  gain: 0.08,
  attackSeconds: 0.015,
  noteSeconds: 0.9,
  // The pluck spacing that reads as a strum, not a chord.
  onsetGapSeconds: 0.09,
};

// The drone's tuning: quiet and low — a two-octave drop from the chime's
// root when the board sings no chord yet.
export const DRONE = {
  baseHz: CHIME.rootHz / 4,
  gain: 0.035,
  // The release that keeps a stop from clicking.
  releaseSeconds: 0.4,
};

// The flow drone's pitch (§6): the board's first chord root, tempered off
// a C4-based register — the drone follows what the hulls name. Chordless
// boards drone the bare root.
export function sessionDroneHz(chords: readonly NamedChordTerm[]): number {
  const root = chords[0]?.root ?? 0;
  return DRONE.baseHz * 2 ** (root / 12);
}

// The intervals a named chord sings, straight from the launch vocabulary.
function intervalsOf(name: string): number[] {
  return NAMED_CHORDS.find((def) => def.name === name)?.intervals ?? FALLBACK_INTERVALS;
}

// A formation strum (§6): the chord's just ratios plucked low to high, one
// quiet sine each. Multiple newcomers strum in sequence.
export function playStrum(ctx: AudioContext | null, chords: readonly NamedChordTerm[]): void {
  if (!ctx || ctx.state !== "running") return;
  let now = ctx.currentTime;
  for (const chord of chords) {
    for (const interval of intervalsOf(chord.name)) {
      const hz = STRUM.rootHz * (JUST_RATIOS[interval % 12] ?? TEMPERED_FIFTH_FALLBACK);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(STRUM.gain, now + STRUM.attackSeconds);
      env.gain.exponentialRampToValueAtTime(0.0001, now + STRUM.noteSeconds);
      osc.connect(env).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + STRUM.noteSeconds + 0.05);
      now += STRUM.onsetGapSeconds;
    }
  }
}

// The flow drone (§6): one sustained quiet voice under the session. The
// browser build keeps the single live drone; a start over one retunes it,
// and a stop releases it.
let drone: { osc: OscillatorNode; gain: GainNode } | null = null;

export function startDrone(ctx: AudioContext | null, hz: number): void {
  if (!ctx || ctx.state !== "running") return;
  if (drone) {
    drone.osc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1);
    return;
  }
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = hz;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(DRONE.gain, ctx.currentTime + 1.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  drone = { osc, gain };
}

export function stopDrone(): void {
  if (!drone) return;
  const { osc, gain } = drone;
  drone = null;
  try {
    const ctx = osc.context;
    gain.gain.setTargetAtTime(0, ctx.currentTime, DRONE.releaseSeconds / 3);
    osc.stop(ctx.currentTime + DRONE.releaseSeconds + 0.1);
  } catch {
    // A stopped context releases nothing; the nodes are dropped regardless.
  }
}

// Fire-and-forget: the answer lands whenever the player gives it, and
// denial or dismissal changes nothing in-session (§4).
export function requestNotificationPermission(): void {
  if (typeof Notification === "undefined") return;
  void Notification.requestPermission();
}

// The non-persistent, silent target notification: the OS never doubles the
// chime, and clicking it focuses the FlowSynth tab — which acknowledges the
// overrun. Delivered notifications are left alone afterwards (§4).
export function showTargetNotification(onFocus: () => void): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const notification = new Notification("FlowSynth", { body: "Target reached.", silent: true });
    notification.addEventListener("click", () => {
      onFocus();
      notification.close();
    });
  } catch {
    // Some engines throw on construction; chime + title carry the signal.
  }
}

export const browserChannels: SignalChannels = {
  unlockAudio,
  playChime,
  playStrum,
  startDrone,
  stopDrone,
  notificationPermission,
  requestNotificationPermission,
  showTargetNotification,
};
