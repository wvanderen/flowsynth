// The habit-build milestone surface (ADR-0046, the v8 wave-2 cut): the
// derivation every later wave reads, computed retroactively and
// idempotently from a habit's credited practice seconds — never stored, so
// earned milestones appear immediately at load and wave 4 needs no second
// version bump. The node catalog itself joins with the builds wave; this
// module fixes only the time seam and the equip-slot ladder.
//
// Milestones key off credited practice per habit — the same stream habit
// development reads (live, honesty-credited, and manual-log together). All
// magnitudes are the spec's provisional tuning.

// The milestone ladder (credited practice seconds per habit): 1h, 5h, 15h,
// 40h, 80h, 150h. Wave 4 hangs one node per rung.
export const BUILD_MILESTONE_SECONDS: readonly number[] = [
  3600,
  5 * 3600,
  15 * 3600,
  40 * 3600,
  80 * 3600,
  150 * 3600,
];

// How many milestones a habit's practice time has crossed — the derivation
// wave 4 maps onto its node catalog. Idempotent in seconds; monotone in
// time.
export function buildUnlocksFor(seconds: number): number {
  return BUILD_MILESTONE_SECONDS.filter((milestone) => seconds >= milestone).length;
}

// The equip-slot ladder (ADR-0046): one slot at the first unlock, +1 at
// 15h, 80h, and 150h — four at most. Time buys options; slots force
// choices.
export const EQUIP_SLOT_MILESTONES: readonly number[] = [
  BUILD_MILESTONE_SECONDS[0]!,
  BUILD_MILESTONE_SECONDS[2]!,
  BUILD_MILESTONE_SECONDS[4]!,
  BUILD_MILESTONE_SECONDS[5]!,
];

export const EQUIP_SLOT_MAX = EQUIP_SLOT_MILESTONES.length;

export function equipSlotsFor(seconds: number): number {
  return EQUIP_SLOT_MILESTONES.filter((milestone) => seconds >= milestone).length;
}
