import type { SignalChannels } from "../signals";

// Record browser signals without playing audio or showing notifications.
export function makeRecorder() {
  const fired = {
    unlocks: 0,
    chimes: 0,
    strums: 0,
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
    playStrum: (_ctx, chords) => {
      fired.strums += chords.length;
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
