import type { NamedChordTerm } from "../../engine/types";
import type { SignalChannels } from "../signals";

// Record browser signals without playing audio or showing notifications.
// The formation cue records the chord it sang, so suites can pin the
// selection contract (issue #390) without hearing anything.
export function makeRecorder() {
  const fired = {
    unlocks: 0,
    chimes: 0,
    strums: 0,
    strumChords: [] as NamedChordTerm[],
    notifications: 0,
    permissionRequests: 0,
    permission: "default" as "default" | "granted" | "denied",
  };
  const channels: SignalChannels = {
    unlockAudio: () => {
      fired.unlocks++;
      return null;
    },
    playChime: () => {
      fired.chimes++;
    },
    playStrum: (_ctx, chord) => {
      fired.strums++;
      fired.strumChords.push(chord);
    },
    notificationPermission: () => fired.permission,
    requestNotificationPermission: () => {
      fired.permissionRequests++;
      fired.permission = "granted";
    },
    showTargetNotification: () => {
      fired.notifications++;
    },
  };
  return { fired, channels };
}
