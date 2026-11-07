// The declared evaluation constants, shared by every calibration and
// balance evaluation (issues #490, #491, #492) and by the recorded-report
// figure generator (issue #512). This module imports nothing: the
// declared matrix, windows, budgets, and measurement versions live in one
// reviewable place, so a report validator can compare recorded evidence
// against the current declaration without loading the engine — and so
// generation (issue #512) structurally cannot simulate.
//
// One constant, one meaning:
// - EVALUATION_SEEDS — the eight declared seeds every evaluation walks
//   (first-prestige exports them as FIRST_PRESTIGE_SEEDS, later eras as
//   LATER_ERA_SEEDS, century as CENTURY_SEEDS; all three are this array).
// - The two session shapes: the suite's baseline 25-minute day and its
//   60-minute variant.
// - The opening window (8–12 credited hours) is #490's opening
//   calibration; the later-era window (5–10) is #491's validation range —
//   a validation range, not a timer.

// The declared seed matrix, shared across #490, #491, and #492.
export const EVALUATION_SEEDS: readonly number[] = [42, 468, 157, 2026, 7, 99, 11, 23];

export const BASELINE_SESSION_MINUTES = 25;
export const LONG_SESSION_MINUTES = 60;

// The three declared World policies (issue #491's parent): the charge
// line before the blade, the blade before the charge line, and no World
// purchases at all.
export const WORLD_POLICIES = ["support", "combat", "ignoring"] as const;
export type WorldPolicyId = (typeof WORLD_POLICIES)[number];

// Each later-era walk targets four positive banks of at least 2 Arete.
export const TARGET_ERAS = 4;

// The later-era walk's day budgets (issue #491): 70 baseline days or 30
// long-session days.
export const LATER_ERA_BUDGET_DAYS = { baseline: 70, long: 30 } as const;

// The later productive eras classify against the roughly 5–10
// credited-hour validation range (ADR-0078 as revised).
export const LATER_ERA_WINDOW = { minHours: 5, maxHours: 10 } as const;

// The opening era's 8–12-hour window is #490's separate calibration; era
// 0 reads against it, never against the later-era window.
export const OPENING_WINDOW = { minHours: 8, maxHours: 12 } as const;

// The century calibration's declared policies (issue #492): the prompt
// and pushing door policies plus the declared World trio.
export const CENTURY_POLICIES = ["prompt", "pushing", "support", "combat", "ignoring"] as const;
export type CenturyPolicyId = (typeof CENTURY_POLICIES)[number];

// A century walk completes at the first between-sessions moment the
// credited clock reaches the 100-credited-hour mark.
export const CENTURY_MARK_HOURS = 100;

// The century walk's day budgets (issue #492).
export const CENTURY_BUDGET_DAYS = { baseline: 140, long: 60 } as const;

// The declared sparse-acquisition stress seeds (issue #492): matrix
// seeds walked by the same recipes, never a hand-built board.
export const SPARSE_ACQUISITION_SEEDS: readonly number[] = [11, 42];

// Boundary-aware century gap measurements (the era-ledger long-gap
// reads); legacy gap summaries without this version cannot establish the
// absence of long waits and are refused at composition.
export const CENTURY_MEASUREMENT_VERSION = 2;

// A "long period with no new decisions" is a recorded failure, not a
// finite-numbers pass. The declared threshold: a credited gap longer than
// two credited hours between meaningful decisions. The declared decision
// rule is #490's: acquisitions, purchases, placements, Arete and World
// products, capacity rungs, feats, World finds; level sweeps and session
// stamps close no gap. The policies act whenever the engine prices an
// action affordable, so a recorded gap is exactly a stretch where nothing
// was affordable and nothing was found — the affordability wait the
// century criterion names.
export const LONG_GAP_CREDITED = 2 * 3600;
