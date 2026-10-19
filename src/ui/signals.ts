import { CHIME, NAMED_CHORDS } from "../engine/constants";
import type { NamedChordTerm } from "../engine/types";

// The signal channels (focus-tool spec §4–5; board-redesign spec §6): the
// synthesized just-intonation chime, the formation strum, and the silent
// non-persistent notification. Every function degrades to a no-op where the
// browser API is missing — denial and absence are silent by design, and
// tests run without either.
//
// Deliberately absent: any flow ambient. An ambient soundscape would need
// to be designed on purpose; until then flow is silent but the strum.

export type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported";

// The seams App fires its signals through; tests inject recorders, the
// browser build uses browserChannels.
export interface SignalChannels {
  unlockAudio(existing: AudioContext | null): AudioContext | null;
  playChime(ctx: AudioContext | null): void;
  playStrum(ctx: AudioContext | null, chord: NamedChordTerm): void;
  notificationPermission(): NotificationPermissionState;
  requestNotificationPermission(): void;
  showTargetNotification(onFocus: () => void, body?: string): void;
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

/* ── The formation strum (§6) ───────────────────────── */

// Just-intonation ratios for the launch chord vocabulary's interval classes
// (mod 12): unison, minor and major third, fifth, flat seventh. The
// fallbacks cover the cases the launch vocabulary never asks: an interval
// class outside the table lands on the tempered fifth, a chord name
// outside NAMED_CHORDS sings a bare fifth.
const JUST_RATIOS: Record<number, number> = { 0: 1, 3: 6 / 5, 4: 5 / 4, 7: 3 / 2, 10: 9 / 5 };
const TEMPERED_FIFTH_FALLBACK = 1.4983;
const FALLBACK_INTERVALS = [0, 7];

// The strum's tuning (§6, bounded and replacing per issue #390: garnish —
// no further sound-design work).
export const STRUM = {
  // The strum's root sits an octave below the chime's, so the two never
  // crowd each other.
  rootHz: CHIME.rootHz / 2,
  gain: 0.08,
  attackSeconds: 0.015,
  noteSeconds: 0.9,
  // The pluck spacing that reads as a strum, not a chord.
  onsetGapSeconds: 0.09,
  // The gap between a note's decay and its oscillator's stop.
  stopMarginSeconds: 0.05,
  // The whole cue's ceiling, tail included: onsets clamp so every note
  // still ends inside the bound, whatever the chord vocabulary sings.
  boundSeconds: 1.5,
};

// The intervals a named chord sings, straight from the launch vocabulary.
function intervalsOf(name: string): number[] {
  return NAMED_CHORDS.find((def) => def.name === name)?.intervals ?? FALLBACK_INTERVALS;
}

// One context's unfinished cue: the oscillators a replacement must stop.
// Keyed weakly, so a discarded context takes its record with it.
const liveCues = new WeakMap<AudioContext, readonly OscillatorNode[]>();

// The formation cue (§6, issue #390): one chord's just ratios plucked low
// to high, one quiet sine each. One chord per action is the App's
// selection; this adapter bounds the whole cue — tail included — to
// STRUM.boundSeconds, and a new cue stops the unfinished one instead of
// queuing or overlapping it.
export function playStrum(ctx: AudioContext | null, chord: NamedChordTerm): void {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  for (const osc of liveCues.get(ctx) ?? []) {
    try {
      osc.stop(now);
    } catch {
      // An already-stopped oscillator refuses a second stop; the cue it
      // sang is over either way.
    }
  }
  const live: OscillatorNode[] = [];
  // The last onset that still lets a note's full tail stop inside the
  // bound; later notes of an oversized vocabulary pile onto it.
  const lastOnset = Math.max(0, STRUM.boundSeconds - STRUM.noteSeconds - STRUM.stopMarginSeconds);
  intervalsOf(chord.name).forEach((interval, index) => {
    const onset = now + Math.min(index * STRUM.onsetGapSeconds, lastOnset);
    const hz = STRUM.rootHz * (JUST_RATIOS[interval % 12] ?? TEMPERED_FIFTH_FALLBACK);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = hz;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, onset);
    env.gain.linearRampToValueAtTime(STRUM.gain, onset + STRUM.attackSeconds);
    env.gain.exponentialRampToValueAtTime(0.0001, onset + STRUM.noteSeconds);
    osc.connect(env).connect(ctx.destination);
    osc.start(onset);
    osc.stop(onset + STRUM.noteSeconds + STRUM.stopMarginSeconds);
    live.push(osc);
  });
  liveCues.set(ctx, live);
}

// Fire-and-forget: the answer lands whenever the player gives it, and
// denial or dismissal changes nothing in-session (§4).
export function requestNotificationPermission(): void {
  if (typeof Notification === "undefined") return;
  void Notification.requestPermission();
}

// The non-persistent, silent target notification: the OS never doubles the
// chime, and clicking it focuses the FlowSynth tab — which acknowledges the
// overrun. Delivered notifications are left alone afterwards (§4). The
// breather's completion rides the same channel with its own body
// (docs/breather-spec.md §4).
export function showTargetNotification(onFocus: () => void, body: string = "Target reached."): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const notification = new Notification("FlowSynth", { body, silent: true });
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
  notificationPermission,
  requestNotificationPermission,
  showTargetNotification,
};
