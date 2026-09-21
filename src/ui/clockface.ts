// The session-clock vocabulary shared by the console's clock block and the
// Time app's popover (§2.2): the caption every running state names itself
// with, and the planned-session fill both tracks read.
import { formatClock } from "../engine/clock";

export const OPEN_ENDED_WORD = "open-ended";

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
