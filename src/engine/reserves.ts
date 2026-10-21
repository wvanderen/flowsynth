import { BALANCE, EPS } from "./constants";
import { hostPower } from "./economy";
import { GENERATOR_PROFILES, generatorProfileOf, type GeneratorProfile } from "./profiles";
import type { GameState } from "./types";

// The practice facts' credit (ADR-0047, generalized by issue #371): each
// seam credits EVERY owned generator, board or tray alike, at the
// generator's own authored profile (profiles.GENERATOR_PROFILES) — full
// independent credit per copy, so copies bank more reserve, not just
// reach. Tray copies bank without emitting (an undeployed generator
// produces nothing). The banked amount is charge QUANTITY, scaled by the
// module's power (level × tier × mutators) exactly as its delivery
// strength is — earning and delivery scale together, so the proportions
// between the axes and the delivery rhythm never move.

// The goal-completion base: the focus equivalent — what a live practice of
// the goal's length would have banked at the focus specialist's own rate.
// The figure's one home is the Flywheel's focus coefficient (the profile
// table), so the "equivalent" can never drift from the earning it names.
export function goalCompletionBase(goalSeconds: number, liveShare: number): number {
  return GENERATOR_PROFILES.focusKeyed.focus * goalSeconds * liveShare;
}

// The one walk the three seams share: every owned generator, its profile,
// and its power, credited in one place.
function creditEachGenerator(state: GameState, credit: (profile: GeneratorProfile, power: number) => number): void {
  for (const module of state.modules) {
    const profile = generatorProfileOf(module.type);
    if (!profile) continue;
    module.reserve += credit(profile, hostPower(state, module));
  }
}

// The banked-earning seam (the session end, actions.endSession): every
// generator banks its profile's focus coefficient per credited practice
// second — the whole window at once, honesty-credited reconciliation
// seconds included. Manual practice logs never pass through here.
export function creditFocusEarning(state: GameState, creditedSeconds: number): void {
  if (!(creditedSeconds > EPS)) return;
  creditEachGenerator(state, (profile, power) => profile.focus * creditedSeconds * power);
}

// The immediate-earning seam at the written-note fact (notes.writeNote):
// every generator banks its profile's character coefficient per stored
// character under the per-note cap, plus its creation bonus once — and
// only once — when the newly created note meets the creation minimum.
// Notes are append-only, so a credit is a write's credit: no edit or
// re-save path exists to re-award it, and a future delete never refunds.
export function creditNoteEarning(state: GameState, storedText: string): void {
  const chars = storedText.length;
  if (!(chars > 0)) return;
  const creationQualified = chars >= BALANCE.noteCreationMinChars;
  creditEachGenerator(state, (profile, power) => {
    let credit = Math.min(chars * profile.noteChar, BALANCE.noteCharCreditCap) * power;
    if (creationQualified) credit += profile.noteCreate * power;
    return credit;
  });
}

// The immediate-earning seam at the completion tick (goals): every
// generator banks its profile's goal coefficient times the completion
// base — the focus equivalent of the goal's credited seconds, prorated by
// the goal's live share, so manual-only completions bank nothing and
// mixed practice banks its live share — under the bounded fuel budget
// (issue #423): the desired total draws against state.goalFuel, scaling
// every generator's credit by the same share when the pool cannot cover
// it in full and flooring at zero. More goals, shorter targets, and
// repeated replacement cannot raise the credit the same credited time
// yields: the pool accrues only at BALANCE.goalFuelPerCreditedSecond per
// credited practice second, on the legs that budget it.
export function creditGoalEarning(state: GameState, goalSeconds: number, liveShare: number): void {
  if (!(goalSeconds > EPS) || !(liveShare > EPS)) return;
  const base = goalCompletionBase(goalSeconds, liveShare);
  let desired = 0;
  for (const module of state.modules) {
    const profile = generatorProfileOf(module.type);
    if (!profile) continue;
    desired += profile.goal * base * hostPower(state, module);
  }
  if (!(desired > EPS)) return;
  const scale = Math.min(1, Math.max(0, state.goalFuel) / desired);
  if (!(scale > EPS)) return;
  creditEachGenerator(state, (profile, power) => profile.goal * base * scale * power);
  state.goalFuel = Math.max(0, state.goalFuel - desired * scale);
}
