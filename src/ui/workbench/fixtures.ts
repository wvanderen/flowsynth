import { createDevScenario } from "../../engine/dev-scenario";
import { createInitialState, createModule } from "../../engine/state";
import { pauseSession, startSession } from "../../engine/actions";
import { createHabit, selectHabit } from "../../engine/habits";
import { createGoal } from "../../engine/goals";
import { memorySaveStorage, SharedSave } from "../shared-save";
import type { SignalChannels } from "../signals";

// Every preview owns an in-memory slot. Even interactive imports, resets,
// beforeunload, and the running App clock cannot read or write the player's save.
export function previewSave(): SharedSave {
  return new SharedSave(memorySaveStorage());
}

export const silentChannels: SignalChannels = {
  unlockAudio: () => null,
  playChime: () => {},
  playStrum: () => {},
  notificationPermission: () => "unsupported",
  requestNotificationPermission: () => {},
  showTargetNotification: () => {},
};

export function previewState(kind: string) {
  if (kind === "opening") return createInitialState();
  const state = createDevScenario();
  const forge = createModule(state, "forge");
  forge.pos = { q: 1, r: 3 };
  state.modules.push(forge);
  state.nous = 2500;
  state.totalEarned = 12000;
  state.eraEarned = 12000;
  state.sessionsCompleted = 6;
  state.prestiges = 1;
  state.catalogEntryOwned = true;
  state.arete = 12;
  state.purchased = { generator: true, infusor: true, forge: true };
  state.goalCapacityBought = 2;
  state.forge.progress = 30;
  state.arcCardSeen = true;
  const habit = createHabit(state, "Piano").habit!;
  habit.seconds = 7200;
  selectHabit(state, habit.id);
  createHabit(state, "Reading");
  createGoal(state, { habitId: habit.id, minutes: 25, schedule: "daily", now: Date.now() });
  if (kind === "flow" || kind === "paused") {
    startSession(state, 1500, Date.now());
    if (kind === "paused") pauseSession(state);
  }
  return state;
}
