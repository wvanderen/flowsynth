import { CHIME } from "../engine/constants";

// The target-hit signal channels (focus-tool spec §4–5): the synthesized
// just-intonation chime and the silent non-persistent notification. Every
// function degrades to a no-op where the browser API is missing — denial
// and absence are silent by design, and tests run without either.

export type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported";

// The seams App fires its signals through; tests inject recorders, the
// browser build uses browserChannels.
export interface SignalChannels {
  unlockAudio(existing: AudioContext | null): AudioContext | null;
  playChime(ctx: AudioContext | null): void;
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
  notificationPermission,
  requestNotificationPermission,
  showTargetNotification,
};
