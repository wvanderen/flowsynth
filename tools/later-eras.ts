import { ARETE_HORIZON, frontierEntitlement } from "../src/engine/accumulator";
import {
  COMBAT_POLICY,
  IGNORING_POLICY,
  PUSHING_POLICY,
  playthroughNote,
  playthroughSource,
  runPlaythrough,
} from "../src/engine/playthrough";
import type { PlaythroughEvent, PlaythroughRecord, PlaythroughRecipe } from "../src/engine/playthrough";
import type { PlaythroughSource } from "../src/engine/playthrough";
import { BALANCE, WORLD_ENEMIES } from "../src/engine/constants";

// The later-era evaluation (issue #491, parent #484 stories 5, 17–27, and
// 42–43): the shipped economy's eras after the first worthwhile prestige,
// read on real scheduled playthroughs — the existing runner, real engine
// actions, no second simulator, no shared-balance mutation, no grant, no
// refund. The declared matrix walks the three declared attitudes — the
// pushing policy (support placement first), the combat-engaging policy
// (weapon power first, blade kept on the fight), and the enemy-ignoring
// policy (no World product, no deployment) — across the declared seeds and
// both declared session shapes, each walk banking its declared era count
// so the claimed frontier strictly grows. Per-era reading — banked claims,
// purchases, deployments, defeats, the recovery measures, the
// familiar/new split, and the finite numeric state — is reconstructed
// from the record's own events, trajectory, and snapshots: one evidence
// store, never a second ledger.
//
// Every figure is a measurement, never a verdict: an era outside the
// 5–10 credited-hour window, an unreached recovery measure, or a budget
// miss stays explicit in its row. The frontier-route read enumerates the
// affordable Arete purchase routes at each tested frontier from the
// authored ladders and the recorded wallets, and names the demonstrated
// no-refund surpass per resistance — a progression trap would be a
// tested frontier with no affordable route and no demonstrated defeat.

// The declared seed matrix (issue #491): the four seeds whose first
// worthwhile prestige demonstrated the whole journey inside the declared
// budget on the baseline schedule (issue #490's recorded rows) — the
// later eras ride the seeds the first era is established on.
export const LATER_ERA_SEEDS: readonly number[] = [42, 468, 7, 23];

// The declared session shapes: the suite's baseline (two 25-minute daily
// sessions) and its 60-minute variant — the same five-minute breather,
// one practice habit with a daily goal (issue #490's shapes).
export const BASELINE_SESSION_MINUTES = 25;
export const LONG_SESSION_MINUTES = 60;

// The declared policies (issue #491): the pushing policy is the
// support-seeking attitude (Charge Columns before Hone ranks), the combat
// policy the combat-engaging one (Hone ranks before Columns, the blade
// relocated onto the fight), and the ignoring policy the enemy-ignoring
// one (no World product, no deployment). The prompt policy's walk
// completes at its first bank and carries no later eras to compare.
export const LATER_ERA_POLICIES: readonly string[] = [PUSHING_POLICY.id, COMBAT_POLICY.id, IGNORING_POLICY.id];

// The declared era count: four banked claims per walk — the claimed
// frontier walking 2 → 8 Arete at the declared target, four frontiers of
// tested ground per run.
export const DECLARED_ERAS = 4;

// The declared budgets, from the target arithmetic: four later eras at
// the 10-credited-hour window's ceiling need 40 credited hours; the
// baseline schedule credits ~0.83 flow hours per day and the long shape
// ~2, so the budgets carry the target plus a half margin. A budget miss
// is a recorded miss, never an extended goalpost.
export const BASELINE_BUDGET_DAYS = 72;
export const LONG_BUDGET_DAYS = 30;

// The later-era cadence (ADR-0078 as revised): roughly 5–10 credited
// hours per productive era. A validation range, not a timer.
export const ERA_WINDOW_MIN_HOURS = 5;
export const ERA_WINDOW_MAX_HOURS = 10;

export type EraHoursClass = "in-window" | "under" | "over";

export function classifyEraHours(hours: number): EraHoursClass {
  if (hours < ERA_WINDOW_MIN_HOURS) return "under";
  if (hours > ERA_WINDOW_MAX_HOURS) return "over";
  return "in-window";
}

function hoursOf(seconds: number | null): number | null {
  return seconds === null ? null : Math.round((seconds / 3600) * 100) / 100;
}

// One banked era's read, reconstructed from the record's own evidence.
// `complete` marks a banked era; the final era of a budget-limited walk
// carries what it reached, explicitly incomplete.
export interface EraLedger {
  readonly era: number;
  readonly complete: boolean;
  // The era's span on both clocks: from the previous bank (or the walk's
  // start) to this era's bank (or the walk's end when incomplete).
  readonly creditedSeconds: number;
  readonly elapsedSeconds: number;
  // The bank: the claim it paid and the claimed frontier it advanced to.
  // Null on an incomplete era — no bank happened.
  readonly claim: number | null;
  readonly frontierAfter: number | null;
  // The era-earned depth the era pushed to — the bank depth when
  // complete, the walk's final depth when not.
  readonly eraEarned: number;
  // The previous era's bank depth: familiar territory's boundary. Null on
  // era 1, whose whole span is new territory by definition.
  readonly previousPeakEraEarned: number | null;
  // Credited time below the previous peak — rebuilding familiar
  // territory — and above it — developing the new frontier. Null on
  // era 1. The split reads at the trajectory's sample resolution, the
  // crossing interpolated linearly between samples.
  readonly familiarCreditedSeconds: number | null;
  readonly newCreditedSeconds: number | null;
  // The recovery measures: the production the reset erased, the credited
  // hour the era first matched it again, and the credited hour prestige
  // eligibility returned — each from the era's start. Era 1 regains
  // nothing (nothing was erased before it): its regain read is null by
  // definition, not by failure. A null on a later era is the explicit
  // unreached mark.
  readonly preResetRate: number | null;
  readonly productionRegainedHours: number | null;
  readonly eligibilityHours: number | null;
  // The consequential opportunities the era recorded: Arete purchases by
  // family, World deployments (placements and relocations), the enemies
  // revealed and defeated, and every declined attempt with the engine's
  // own reason.
  readonly aretePurchases: number;
  readonly honeRanks: number;
  readonly columns: number;
  readonly deployments: number;
  readonly relocations: number;
  readonly discoveries: readonly string[];
  readonly defeats: readonly string[];
  readonly declines: readonly string[];
  // The era's closing production — the last sample before the reset, the
  // rate the next era regains — and the Arete wallet the era closed with.
  readonly closingRate: number;
  readonly walletArete: number;
  // Whether every figure behind this ledger — the era's samples and the
  // closing state — is finite. A non-finite figure fails the row loudly
  // (issue #491's finite-state criterion), never hides in a rounding.
  readonly finite: boolean;
}

// The record's prestige events, in order: the era boundaries. Every bank
// is an ok prestige; the runner records no other kind.
function prestigeEventsOf(record: PlaythroughRecord): PlaythroughEvent[] {
  return record.events.filter((event) => event.kind === "prestige" && event.ok);
}

// The trajectory sample a recorded moment stands on: the latest sample
// bound before the given snapshot index. The runner stamps every event
// with the snapshot that closed it, so the pre-bank sample — the rate and
// depth the reset erased — is the latest sample before the bank's own
// snapshot.
function sampleBefore(record: PlaythroughRecord, snapshot: number) {
  let hit: (typeof record.trajectory)[number] | null = null;
  for (const point of record.trajectory) {
    if (point.snapshot >= snapshot) break;
    hit = point;
  }
  return hit;
}

// The credited-time split of an era around a depth boundary, from the
// era's samples. Each inter-sample span attributes linearly: the crossing
// of the boundary between two samples sits at the proportional credited
// point between them.
function familiarSplit(
  points: readonly { credited: number; eraEarned: number }[],
  startCredited: number,
  endCredited: number,
  boundary: number,
): { familiar: number; fresh: number } {
  let familiar = 0;
  let fresh = 0;
  let previous: { credited: number; eraEarned: number } | null = null;
  for (const point of points) {
    const clamped = {
      credited: Math.min(Math.max(point.credited, startCredited), endCredited),
      eraEarned: point.eraEarned,
    };
    if (previous === null) {
      if (clamped.credited > startCredited) {
        if (clamped.eraEarned <= boundary) familiar += clamped.credited - startCredited;
        else fresh += clamped.credited - startCredited;
      }
    } else {
      const span = clamped.credited - previous.credited;
      if (span > 0) {
        const belowStart = previous.eraEarned <= boundary;
        const belowEnd = clamped.eraEarned <= boundary;
        if (belowStart === belowEnd) {
          if (belowStart) familiar += span;
          else fresh += span;
        } else {
          const share = Math.min(1, Math.max(0, (boundary - previous.eraEarned) / (clamped.eraEarned - previous.eraEarned)));
          if (belowStart) {
            familiar += span * share;
            fresh += span * (1 - share);
          } else {
            fresh += span * share;
            familiar += span * (1 - share);
          }
        }
      }
    }
    previous = clamped;
    if (clamped.credited >= endCredited) break;
  }
  // The tail past the last sample attributes to its side by the sample
  // it extends from — there is no production figure beyond the record.
  if (previous !== null && previous.credited < endCredited) {
    if (previous.eraEarned <= boundary) familiar += endCredited - previous.credited;
    else fresh += endCredited - previous.credited;
  }
  return { familiar, fresh };
}

function finiteState(state: PlaythroughRecord["state"]): boolean {
  const figures = [state.nous, state.eraEarned, state.totalEarned, state.arete, state.scrap];
  for (const figure of figures) {
    if (!Number.isFinite(figure)) return false;
  }
  for (const enemy of Object.values(state.world.enemies)) {
    if (!Number.isFinite(enemy.hp)) return false;
  }
  return true;
}

// The era ledgers of one recorded run: pure over the record, reading only
// its events, trajectory, and snapshots. A frozen record stays frozen.
// Discoveries and defeats read the era's closing state rather than the
// action record's milestones: the runner records each enemy's first
// discovery and defeat once per run (the milestones are run-level
// history), while every era starts from the prestige's fresh, hidden
// roster — so "discovered at the era's close" and "hp at zero at the
// era's close" are the per-era truths, and nothing regenerates HP inside
// an era to blur them.
export function eraLedgersOf(record: PlaythroughRecord): EraLedger[] {
  const banks = prestigeEventsOf(record);
  const finalCredited = record.creditedSeconds;
  const finalElapsed = record.elapsedSeconds;
  const ledgers: EraLedger[] = [];
  for (let index = 0; index < banks.length + 1; index++) {
    const bank = banks[index];
    const startEvent = index === 0 ? null : banks[index - 1]!;
    const startCredited = startEvent?.credited ?? 0;
    const startElapsed = startEvent?.at ?? 0;
    const complete = bank !== undefined;
    const endCredited = complete ? bank!.credited : finalCredited;
    const endElapsed = complete ? bank!.at : finalElapsed;
    // A span-less trailing read is no era: a walk that stopped at its own
    // last bank (or ended its budget exactly on one) leaves nothing open
    // to record.
    if (!complete && endCredited <= startCredited) break;
    // The era's samples: everything stamped inside its span.
    const points = record.trajectory.filter((point) => point.credited > startCredited && point.credited <= endCredited);
    const closingSample = complete ? sampleBefore(record, bank!.snapshot) : record.trajectory.at(-1) ?? null;
    // A bank with no prior sample (a walk that banks before its first
    // session) recorded no depth to close on — the honest read is zero,
    // never the walk's final depth dressed up as this era's.
    const eraEarned = closingSample?.eraEarned ?? (complete ? 0 : record.state.eraEarned);
    // The era's closing snapshot: the last recorded state before the bank
    // — the era as it stood when the reset erased it. A bank with no prior
    // sample (a walk that banks before its first session) closes on the
    // bank's own snapshot, which is the honest empty read.
    const closingIndex = complete
      ? closingSample?.snapshot ?? bank!.snapshot
      : (record.trajectory.at(-1)?.snapshot ?? record.snapshots.length - 1);
    const closingSnapshot = record.snapshots[closingIndex]!;
    const previousPeak = index === 0 ? null : sampleBefore(record, startEvent!.snapshot)?.eraEarned ?? null;
    // The recovery reads. The rate this era's own bank erased is its
    // closing production; the rate the era must rebuild is the one the
    // PREVIOUS bank erased — era k regains era k−1's pre-reset
    // production. Era 1 rebuilds nothing (nothing was erased before it):
    // its regain read is null by definition, not by failure.
    const preReset = complete ? sampleBefore(record, bank!.snapshot)?.rate ?? null : null;
    const rebuildTarget = index > 0 && startEvent ? sampleBefore(record, startEvent.snapshot)?.rate ?? null : null;
    const regained = rebuildTarget !== null
      ? points.find((point) => point.rate >= rebuildTarget)?.credited ?? null
      : null;
    const eligibility = points.find((point) => point.eraEarned >= ARETE_HORIZON)?.credited ?? null;
    const split = previousPeak !== null
      ? familiarSplit(
        points.map((point) => ({ credited: point.credited, eraEarned: point.eraEarned })),
        startCredited,
        endCredited,
        previousPeak,
      )
      : null;
    const events = record.events.filter((event) => event.credited > startCredited && event.credited <= endCredited);
    const declines: string[] = [];
    let aretePurchases = 0;
    let honeRanks = 0;
    let columns = 0;
    let deployments = 0;
    let relocations = 0;
    for (const event of events) {
      if (!event.ok) {
        declines.push(event.reason ? `${event.label} — ${event.reason}` : event.label);
        continue;
      }
      if (event.kind === "arete") {
        aretePurchases++;
      }
      // The World products ride "world" events: the Column and Hone
      // purchases record their own lines, and the placements record the
      // deployed seat.
      if (event.kind === "world") {
        if (event.label === "World Column") {
          columns++;
          aretePurchases++;
        }
        if (event.label.startsWith("Hone rank")) {
          honeRanks++;
          aretePurchases++;
        }
      }
      if (event.kind === "world" && event.label.startsWith("Placed")) {
        deployments++;
        if (event.label.includes("relocated")) relocations++;
      }
    }
    // The per-era World truth from the era's closing state: every era
    // opens on the prestige's fresh roster, so a discovered enemy at close
    // was revealed this era, and a defeated one was beaten this era.
    const closingState = closingSnapshot.state;
    const discoveries: string[] = [];
    const defeats: string[] = [];
    for (const def of WORLD_ENEMIES) {
      const live = closingState.world.enemies[def.key];
      if (!live?.discovered) continue;
      discoveries.push(def.key);
      if (live.hp <= 0) defeats.push(def.key);
    }
    // The finite read: every sample figure this ledger is built from,
    // plus the era's closing state.
    let finite = finiteState(record.state);
    for (const point of points) {
      if (![point.rate, point.eraEarned, point.nous, point.arete].every(Number.isFinite)) finite = false;
    }
    if (!finiteState(closingSnapshot.state)) finite = false;
    ledgers.push({
      era: index + 1,
      complete,
      creditedSeconds: Math.max(0, Math.round(endCredited - startCredited)),
      elapsedSeconds: Math.max(0, Math.round(endElapsed - startElapsed)),
      claim: complete ? record.claims[index] ?? null : null,
      frontierAfter: complete ? record.claims.slice(0, index + 1).reduce((sum, claim) => sum + claim, 0) : null,
      eraEarned,
      previousPeakEraEarned: previousPeak,
      familiarCreditedSeconds: split === null ? null : Math.round(split.familiar),
      newCreditedSeconds: split === null ? null : Math.round(split.fresh),
      preResetRate: preReset,
      productionRegainedHours: regained === null ? null : Math.round(((regained - startCredited) / 3600) * 100) / 100,
      eligibilityHours: hoursOf(eligibility === null ? null : eligibility - startCredited),
      aretePurchases,
      honeRanks,
      columns,
      deployments,
      relocations,
      discoveries,
      defeats,
      declines,
      closingRate: closingSample?.rate ?? closingSnapshot.rate ?? 0,
      // The wallet the era handed forward: a banked era's post-bank Arete
      // is exactly the next era's opening purse; an open era closes on
      // its own last recorded wallet.
      walletArete: complete ? record.snapshots[bank!.snapshot]!.state.arete : closingSnapshot.state.arete,
      finite,
    });
  }
  return ledgers;
}

// Whether the run's claimed frontier strictly grew: every banked claim is
// a whole Arete step, so the prefix sums climb by at least one each bank.
// A run that banked nothing carries no frontier to grow.
export function frontierStrictlyGrowing(record: PlaythroughRecord): boolean {
  return record.claims.length > 0 && record.claims.every((claim) => claim >= 1);
}

// The currency-integrity read: the state's whole intake against everything
// the walk earned through real sessions and breathers — a hidden grant,
// missing currency, or fabricated reward fails.
export function noGrantRead(record: PlaythroughRecord): boolean {
  const drift = Math.abs(record.state.totalEarned - record.earnedNous);
  return drift < Math.max(1, record.earnedNous) * 1e-12;
}

// One run's row: the declared inputs, the per-era ledgers, and the honest
// stop.
export interface LaterEraRow {
  readonly seed: number;
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly erasTarget: number;
  readonly complete: boolean;
  readonly stopKind: string;
  readonly stopReason: string;
  readonly days: number;
  readonly creditedHours: number;
  readonly claims: readonly number[];
  readonly frontiers: readonly number[];
  readonly ledgers: readonly EraLedger[];
  readonly eraClasses: readonly (EraHoursClass | "incomplete")[];
  // The familiar share of each banked later era (era 2 onward): the
  // credited fraction spent below the previous peak. Rebuilding must not
  // consume most of any later era — the 0.5 line is the read.
  readonly familiarShares: readonly number[];
  readonly inWindowEras: number;
  readonly overWindowEras: number;
  readonly underWindowEras: number;
  readonly noGrant: boolean;
  readonly frontierStrictlyGrowing: boolean;
  readonly bottleneck: string | null;
  readonly note: string;
}

export function laterEraRow(seed: number, sessionMinutes: number, record: PlaythroughRecord): LaterEraRow {
  const ledgers = eraLedgersOf(record);
  const classes = ledgers.map((ledger) => {
    const hours = ledger.creditedSeconds / 3600;
    return ledger.complete ? classifyEraHours(hours) : "incomplete" as const;
  });
  const familiarShares = ledgers.filter((ledger) => ledger.complete && ledger.familiarCreditedSeconds !== null)
    .map((ledger) => ledger.familiarCreditedSeconds! / Math.max(1, ledger.creditedSeconds));
  let frontier = 0;
  const frontiers = record.claims.map((claim) => (frontier += claim));
  return {
    seed,
    sessionMinutes,
    policy: record.policy.id,
    erasTarget: record.recipe.eras,
    complete: record.complete,
    stopKind: record.stop.kind,
    stopReason: record.stop.reason,
    days: record.days,
    creditedHours: hoursOf(record.creditedSeconds)!,
    claims: record.claims,
    frontiers,
    ledgers,
    eraClasses: classes,
    familiarShares,
    inWindowEras: classes.filter((entry) => entry === "in-window").length,
    overWindowEras: classes.filter((entry) => entry === "over").length,
    underWindowEras: classes.filter((entry) => entry === "under").length,
    noGrant: noGrantRead(record),
    frontierStrictlyGrowing: frontierStrictlyGrowing(record),
    bottleneck: record.bottleneck,
    note: playthroughNote(record),
  };
}

// The declared recipe for one matrix cell: composed here in one visible
// place; the runner validates the whole recipe again on the walk.
export function laterEraRecipe(seed: number, sessionMinutes: number, policyId: string): PlaythroughRecipe {
  return {
    scenarioId: "fresh-start",
    seed,
    policyId,
    claimTarget: 2,
    schedule: {
      sessionsPerDay: 2,
      sessionMinutes,
      breatherMinutes: 5,
      habitName: "Practice",
      goalMinutes: 25,
      startAt: Date.UTC(2026, 0, 5, 9, 0, 0),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    budgetDays: sessionMinutes === BASELINE_SESSION_MINUTES ? BASELINE_BUDGET_DAYS : LONG_BUDGET_DAYS,
    eras: DECLARED_ERAS,
    responseCurve: "shipped",
    overrides: {},
  };
}

// ── The frontier-route read (issue #491's affordability criterion) ──

// One tested frontier's affordable-route enumeration: the authored Arete
// ladders read at the recorded opening wallet plus the era's expected
// claim, against the resistance waiting at that frontier's bank depth.
// The demonstration is the recorded defeat count — configurations that
// actually surpassed the resistance under the no-refund rules.
export interface FrontierRoute {
  readonly frontier: number;
  // The era-earned depth whose entitlement banks this frontier's next
  // claim: E(D) = F + claim → D = entry × 10^(F/2) at the authored slope.
  readonly bankDepth: number;
  readonly claim: number;
  // The resistance waiting there: the authored enemy whose reveal
  // threshold sits at the bank depth.
  readonly enemy: string;
  readonly enemyHp: number;
  // The affordable routes: how far each authored ladder walks on the
  // opening wallet plus the era's claim, from the recorded owned ranks.
  // Null wallet when no recorded run reached this frontier (the ladders
  // then read from zero ranks and an empty wallet).
  readonly openingWalletArete: number | null;
  readonly honeRanksOwned: number;
  readonly honeRanksAffordable: number;
  readonly honeCeilingReached: boolean;
  readonly columnsOwned: number;
  readonly columnsAffordable: number;
  // The surpass arithmetic at the affordable Hone ranks: the blade's
  // attack power and the fed kill time at the authored cadence — the
  // configuration's ability to out-damage the resistance's authored HP
  // within an era's credited hours.
  readonly attackPower: number;
  readonly fedKillMinutes: number;
  // The recorded no-refund surpass: how many recorded era ledgers defeated
  // this enemy.
  readonly defeatedInLedgers: number;
  // The trap read: a tested frontier with no affordable World purchase
  // and no demonstrated defeat. Empty string when the frontier routes
  // forward; the named finding when it does not.
  readonly trap: string;
}

// The authored ladders, read by the same constants the engine's
// purchase actions price from (world.ts's state readers price identical
// figures — the ladder walk here needs only the rank).
function honeCostAtRank(rank: number): number | null {
  const ladder = BALANCE.world.honeCosts;
  return rank < ladder.length ? ladder[rank]! : null;
}

function attackPowerAtRank(rank: number): number {
  return BALANCE.world.attackBase + rank * BALANCE.world.honeAttackPerRank;
}

// The tested frontiers of a set of rows: every banked claimed frontier,
// with the recorded opening wallet, owned ranks, and defeat ledger at it.
export function frontierRoutesOf(rows: readonly LaterEraRow[]): FrontierRoute[] {
  const maxFrontier = Math.max(0, ...rows.flatMap((row) => row.frontiers));
  const routes: FrontierRoute[] = [];
  for (let frontier = 2; frontier <= maxFrontier; frontier += 2) {
    const bankDepth = BALANCE.world.entryNous * 10 ** (frontier / BALANCE.world.claimDepthSlope);
    const claim = Math.floor(frontierEntitlement(bankDepth) - frontier);
    const enemyIndex = Math.min(frontier / BALANCE.world.claimDepthSlope, WORLD_ENEMIES.length - 1);
    const enemy = WORLD_ENEMIES[enemyIndex]!;
    // The recorded state at this frontier: the closing wallet and owned
    // ranks of the banked eras that stood there.
    let wallet: number | null = null;
    let honeRanksOwned = 0;
    let columnsOwned = 0;
    for (const row of rows) {
      for (const ledger of row.ledgers) {
        if (ledger.frontierAfter !== frontier) continue;
        wallet = wallet === null ? ledger.walletArete : Math.max(wallet, ledger.walletArete);
        honeRanksOwned = Math.max(honeRanksOwned, ledger.honeRanks);
        columnsOwned = Math.max(columnsOwned, ledger.columns);
      }
    }
    const defeats = rows.reduce(
      (sum, row) => sum + row.ledgers.filter((ledger) => ledger.defeats.includes(enemy.key)).length,
      0,
    );
    const budget = (wallet ?? 0) + claim;
    // The Hone ladder from the recorded ranks: each next authored price
    // the budget clears walks one rank.
    let rank = honeRanksOwned;
    let honeLeft = budget;
    while (honeLeft > 0) {
      const price = honeCostAtRank(rank);
      if (price === null || price > honeLeft) break;
      honeLeft -= price;
      rank++;
    }
    // The Column ladder from the recorded copies.
    let columnCount = columnsOwned;
    let columnLeft = budget;
    while (columnLeft > 0) {
      const price = BALANCE.world.columnFirstPrice * BALANCE.world.columnPriceGrowth ** columnCount;
      if (price > columnLeft) break;
      columnLeft -= price;
      columnCount++;
    }
    const attack = attackPowerAtRank(rank);
    const fedKillMinutes = Math.ceil(enemy.maxHp / attack) * (BALANCE.world.attackCadenceSeconds / 60);
    const affordableAny = rank > honeRanksOwned || columnCount > columnsOwned;
    const trap = affordableAny || defeats > 0
      ? ""
      : `frontier ${frontier}: no authored Arete purchase is affordable on the opening wallet plus the era's claim, and no recorded era defeated ${enemy.key} — a progression trap`;
    routes.push({
      frontier,
      bankDepth,
      claim,
      enemy: enemy.key,
      enemyHp: enemy.maxHp,
      openingWalletArete: wallet,
      honeRanksOwned,
      honeRanksAffordable: rank - honeRanksOwned,
      honeCeilingReached: honeCostAtRank(rank) === null,
      columnsOwned,
      columnsAffordable: columnCount - columnsOwned,
      attackPower: attack,
      fedKillMinutes,
      defeatedInLedgers: defeats,
      trap,
    });
  }
  return routes;
}

// ── The policy comparison (issue #491's attitude comparison) ──

// One policy's slice across the matrix: what its attitude demonstrably
// bought — banked eras, completed walks, defeats, relocation behavior,
// the familiar share of later eras, and the era-hours classes.
export interface PolicySlice {
  readonly policy: string;
  readonly runs: number;
  readonly bankedEras: number;
  readonly completedRuns: number;
  readonly defeats: number;
  readonly relocations: number;
  readonly meanFamiliarShare: number | null;
  readonly inWindowEras: number;
  readonly overWindowEras: number;
  readonly underWindowEras: number;
  readonly incompleteEras: number;
}

export function policySlicesOf(rows: readonly LaterEraRow[]): PolicySlice[] {
  return LATER_ERA_POLICIES.map((policy) => {
    const slice = rows.filter((row) => row.policy === policy);
    const bankedLedgers = slice.flatMap((row) => row.ledgers.filter((ledger) => ledger.complete));
    const shares = slice.flatMap((row) => row.familiarShares);
    return {
      policy,
      runs: slice.length,
      bankedEras: bankedLedgers.length,
      completedRuns: slice.filter((row) => row.complete).length,
      defeats: bankedLedgers.reduce((sum, ledger) => sum + ledger.defeats.length, 0),
      relocations: slice.reduce(
        (sum, row) => sum + row.ledgers.reduce((inner, ledger) => inner + ledger.relocations, 0),
        0,
      ),
      meanFamiliarShare: shares.length > 0
        ? Math.round((shares.reduce((sum, share) => sum + share, 0) / shares.length) * 1000) / 1000
        : null,
      inWindowEras: slice.reduce((sum, row) => sum + row.inWindowEras, 0),
      overWindowEras: slice.reduce((sum, row) => sum + row.overWindowEras, 0),
      underWindowEras: slice.reduce((sum, row) => sum + row.underWindowEras, 0),
      incompleteEras: slice.reduce((sum, row) => sum + row.ledgers.filter((ledger) => !ledger.complete).length, 0),
    };
  });
}

export interface LaterErasReport {
  readonly window: { readonly minHours: number; readonly maxHours: number };
  readonly seeds: readonly number[];
  readonly policies: readonly string[];
  readonly eras: number;
  readonly budgets: { readonly baselineDays: number; readonly longDays: number };
  readonly source: PlaythroughSource;
  readonly runs: readonly LaterEraRow[];
  readonly policySlices: readonly PolicySlice[];
  readonly frontierRoutes: readonly FrontierRoute[];
}

// The full declared matrix: the declared seeds × both session shapes ×
// the three declared attitudes, each a real scheduled walk to its declared
// era count.
export function laterErasReport(): LaterErasReport {
  const runs: LaterEraRow[] = [];
  for (const sessionMinutes of [BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES]) {
    for (const policyId of LATER_ERA_POLICIES) {
      for (const seed of LATER_ERA_SEEDS) {
        const record = runPlaythrough(laterEraRecipe(seed, sessionMinutes, policyId));
        runs.push(laterEraRow(seed, sessionMinutes, record));
      }
    }
  }
  return {
    window: { minHours: ERA_WINDOW_MIN_HOURS, maxHours: ERA_WINDOW_MAX_HOURS },
    seeds: LATER_ERA_SEEDS,
    policies: LATER_ERA_POLICIES,
    eras: DECLARED_ERAS,
    budgets: { baselineDays: BASELINE_BUDGET_DAYS, longDays: LONG_BUDGET_DAYS },
    source: playthroughSource(),
    runs,
    policySlices: policySlicesOf(runs),
    frontierRoutes: frontierRoutesOf(runs),
  };
}
