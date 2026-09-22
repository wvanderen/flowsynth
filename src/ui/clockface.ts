// The session-clock vocabulary shared by the console's clock block and the
// Time app's popover (§2.2): the caption every running state names itself
// with, and the planned-session fill both tracks read.
import { formatClock } from "../engine/clock";
import type { GameState } from "../engine/types";

export const OPEN_ENDED_WORD = "open-ended";

// The clock facts both clock blocks read off state — elapsed, the plan's
// target, the pause flag — derived once here rather than re-derived per
// consumer.
export interface SessionClock {
  elapsed: number;
  target: number | null;
  paused: boolean;
}

export function sessionClock(state: GameState): SessionClock {
  return {
    elapsed: state.session?.elapsed ?? 0,
    target: state.session?.target ?? null,
    paused: state.mode === "paused",
  };
}

// The running-session caption: every running state names itself — paused,
// open-ended, target reached, or what remains of the plan.
export function sessionCaption(elapsed: number, target: number | null, paused: boolean): string {
  const reached = target !== null && elapsed >= target;
  return paused
    ? "paused"
    : target === null
      ? OPEN_ENDED_WORD
      : reached
        ? "target reached"
        : `of ${formatClock(target)}`;
}

// Share of a planned session already practiced, as a fill percentage.
export function plannedFill(elapsed: number, target: number): string {
  return `${Math.min(100, (elapsed / target) * 100)}%`;
}

// Fill width for the Time app popover's local track; open-ended leaves it
// empty — the console header's strip is what pulses for those.
export function sessionTrackWidth(elapsed: number, target: number | null): string {
  return target === null ? "0%" : plannedFill(elapsed, target);
}
