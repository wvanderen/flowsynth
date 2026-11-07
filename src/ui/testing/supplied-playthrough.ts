import {
  PLAYTHROUGH_POLICIES,
  PLAYTHROUGH_RUNNER_VERSION,
  composePlaythroughRecipe,
  deepFreeze,
  playthroughRunId,
  stateNumbersFinite,
  type PlaythroughAreteSpent,
  type PlaythroughEvent,
  type PlaythroughEraLedger,
  type PlaythroughRecovery,
  type PlaythroughRecord,
  type PlaythroughRecipeInput,
  type PlaythroughSnapshot,
  type PlaythroughSnapshotNumbers,
  type PlaythroughSource,
  type PlaythroughTrajectoryPoint,
} from "../../engine/playthrough";
import { exportPlaythroughArtifact, type PlaythroughArtifactIntervention } from "../../engine/playthrough-artifact";
import { SAVE_VERSION } from "../../engine/constants";
import { syncRates } from "../../engine/economy";
import { cellNoteOf } from "../../engine/lattice";
import { createInitialState } from "../../engine/state";
import type { GameState } from "../../engine/types";

// The supplied-record builder (issue #510, ADR-0085): explicit
// constructed evidence for the playthrough presentation tests. A
// presentation case needs a record to read — plotted samples, stamped
// decisions, historical boards,
// recovery marks, the note's figures — and walking a full progression to
// establish every UI setup repeated expensive journeys whose balance
// outcomes the case never asserted. A supplied record states the facts
// the case needs, in the record's own shape, and enters the app through
// the real artifact boundary — the same import path recorded evidence
// takes — so the presentation reads exactly what it would read off a
// recorded run.
//
// Honesty rules the builder:
// - **Origin is explicit.** The carried source names `SUPPLIED_ENGINE_SOURCE`,
//   so the record's provenance reads as constructed evidence, never a
//   current-engine walk — the curves panel marks it "≠ current", the
//   library marks the entry imported, and the note rides the "Imported · "
//   prefix. A supplied record is never reachability evidence: nothing
//   here may stand in for "the engine reaches this" — that remains the
//   named integration walks' job (the file's integration set).
// - **The shape is the walk's shape.** Snapshots capture through the same
//   form `runPlaythrough`'s snap performs — clone, rate-sync on the same
//   preview basis, sorted voices, captured figures off the same clone,
//   deep-frozen — so a supplied record exercises the presentation with
//   the structures a recorded run carries, including tied clocks,
//   era-local events, and explicitly unreached (null) marks.
// - **The facts are the test's.** Nothing here derives balance outcomes,
//   banks, or completion days; every figure a record carries is written
//   by the case that declares it.

// The constructed-origin marker the supplied records carry in
// `source.engineSource`: no current engine fingerprint ever reads this
// way, so a supplied record cannot masquerade as a fresh walk anywhere
// provenance is shown.
export const SUPPLIED_ENGINE_SOURCE = "supplied-constructed";

export function suppliedSource(): PlaythroughSource {
  return {
    game: "flowsynth",
    saveVersion: SAVE_VERSION,
    runnerVersion: PLAYTHROUGH_RUNNER_VERSION,
    engineSource: SUPPLIED_ENGINE_SOURCE,
  };
}

// A fresh initial state through the engine's own creation seam, patched
// by the case. The patch writes facts through the same seams the
// scenario builders use (ADR-0077) — `createModule`, `hex`, the World
// fields — never by inventing a second state shape.
export function suppliedState(patch?: (state: GameState) => void): GameState {
  const state = createInitialState();
  patch?.(state);
  return state;
}

// One stamped decision, as the walk's action record writes it: the
// simulated moment, credited practice so far, what was attempted, and the
// snapshot index that carries the decision's exact board.
export function suppliedEvent(event: Omit<PlaythroughEvent, "ok"> & { ok?: boolean }): PlaythroughEvent {
  return { ok: true, ...event };
}

export interface SuppliedSnapshotFacts {
  // The state as it stood — unfrozen; the capture clones, rate-syncs,
  // and freezes its own copy, like the walk's snap does.
  readonly state: GameState;
  // Simulated elapsed seconds since the anchor; credited practice so far.
  readonly elapsed: number;
  readonly credited: number;
}

// The walk's capture shape: clone, rate-sync on the preview basis, sorted
// deployed voices with their contributions, figures off the same clone,
// deep-frozen. A supplied snapshot is structurally what a recorded run
// carries — the presentation cannot tell one apart, which is the point.
export function suppliedSnapshot(facts: SuppliedSnapshotFacts): PlaythroughSnapshot {
  const captured = structuredClone(facts.state);
  const rates = syncRates(captured, false);
  const maxLevel = captured.modules.reduce((max, module) => Math.max(max, module.level), 0);
  const maxAbsReserve = captured.modules.reduce((max, module) => Math.max(max, Math.abs(module.reserve)), 0);
  const numbers: PlaythroughSnapshotNumbers = {
    nous: captured.nous,
    eraEarned: captured.eraEarned,
    totalEarned: captured.totalEarned,
    arete: captured.arete,
    prestiges: captured.prestiges,
    frontier: captured.world.frontier,
    maxLevel,
    maxAbsReserve,
    finite: stateNumbersFinite(captured),
    // Complete records carry zeros here: the serialized stride is a
    // bounded-record capture verdict, checked at report time off the
    // retained states (issue #509).
    serializedChecks: 0,
    serializedOk: 0,
  };
  return deepFreeze({
    rate: rates.rate,
    voices: deepFreeze(captured.modules
      .filter(module => module.pos !== null)
      .sort((a, b) => a.pos!.r - b.pos!.r || a.pos!.q - b.pos!.q || a.id.localeCompare(b.id))
      .map(module => ({ type: module.type, note: cellNoteOf(module.pos!), level: module.level,
        nuPerSecond: rates.contributions.get(module.id)?.value ?? null }))),
    elapsed: facts.elapsed,
    credited: facts.credited,
    numbers,
    state: deepFreeze(captured),
  });
}

const ZERO_SPENT: PlaythroughAreteSpent = { entry: 0, discounts: 0, ceilings: 0, columns: 0, rowUnlocks: 0, hone: { chargeBlade: 0 } };

// One open era, as the walk opens: nothing banked, nothing closed. Cases
// declare their own ledgers for bank-era boundaries.
function openEra(): PlaythroughEraLedger {
  return {
    index: 0, startElapsed: 0, startCredited: 0,
    endElapsed: null, endCredited: null, claim: null, frontierAfter: null,
    priorDepth: null, priorRate: null, familiarCredited: 0, newCredited: 0,
    productionRegained: null, priorDepthPassed: null, finite: null,
  };
}

export interface SuppliedRecordFacts {
  // The recipe the record declares, composed and validated like any
  // other. Defaults to the fresh-start recipe at seed 510 (this issue's
  // supplied seed); a case needing its own identity passes seed, policy,
  // target, or schedule explicitly.
  readonly recipe?: PlaythroughRecipeInput;
  readonly complete?: boolean;
  readonly stop?: PlaythroughRecord["stop"];
  // The run-summary facts the case declares. Unspecified figures default
  // to the record's own shape — clocks from the last snapshot, one open
  // era, no claims, nothing spent — never to a shipped balance outcome.
  readonly claims?: readonly number[];
  readonly days?: number;
  readonly elapsedSeconds?: number;
  readonly creditedSeconds?: number;
  readonly breatherSeconds?: number;
  readonly manageBreaks?: number;
  readonly sessionNous?: number;
  readonly breatherNous?: number;
  readonly lastMilestone?: string | null;
  readonly bottleneck?: string | null;
  readonly areteSpent?: PlaythroughAreteSpent;
  readonly events?: readonly PlaythroughEvent[];
  readonly trajectory?: readonly PlaythroughTrajectoryPoint[];
  readonly snapshots?: readonly PlaythroughSnapshot[];
  readonly recovery?: PlaythroughRecovery | null;
  readonly eras?: readonly PlaythroughEraLedger[];
  readonly achievements?: readonly string[];
  readonly worldDiscoveries?: readonly string[];
  readonly worldDefeats?: readonly string[];
  // The final state — the record's ground truth. Defaults to a clone of
  // the last snapshot's board, so the record closes on its own history.
  readonly state?: GameState;
  // The carried modified status, exactly as an artifact preserves it.
  readonly modified?: boolean;
  readonly interventions?: readonly PlaythroughArtifactIntervention[];
}

// The assembled record: the facts as declared, in the record's own shape,
// with the constructed origin carried in its source and its identity
// derived the way the runner derives one (recipe + source — here the
// supplied marker, so the same facts share one identity and any change of
// facts or recipe makes a new one).
export function suppliedRecord(facts: SuppliedRecordFacts = {}): PlaythroughRecord {
  const recipe = composePlaythroughRecipe(facts.recipe ?? { seed: 510 });
  const source = suppliedSource();
  const policy = PLAYTHROUGH_POLICIES.find((candidate) => candidate.id === recipe.policyId)!;
  const snapshots = facts.snapshots ??
    [suppliedSnapshot({ state: createInitialState(), elapsed: 0, credited: 0 })];
  const last = snapshots.at(-1)!;
  const elapsedSeconds = facts.elapsedSeconds ?? last.elapsed;
  const creditedSeconds = facts.creditedSeconds ?? last.credited;
  const sessionNous = facts.sessionNous ?? 0;
  const breatherNous = facts.breatherNous ?? 0;
  const complete = facts.complete ?? false;
  const days = facts.days ?? Math.max(1, Math.ceil(elapsedSeconds / 86_400));
  const stop = facts.stop ?? {
    kind: "budget" as const,
    reason: `The ${days}-day budget ended inside the supplied record's declared facts.`,
  };
  const state = facts.state
    ? structuredClone(facts.state)
    : structuredClone(last.state!);
  return {
    kind: "representative",
    runId: playthroughRunId(recipe, source),
    recipe,
    source,
    policy: { id: policy.id, name: policy.name },
    complete,
    stop,
    claimTarget: recipe.claimTarget,
    claims: facts.claims ?? [],
    areteSpent: facts.areteSpent ?? ZERO_SPENT,
    days,
    elapsedSeconds,
    creditedSeconds,
    breatherSeconds: facts.breatherSeconds ?? 0,
    manageBreaks: facts.manageBreaks ?? 0,
    earnedNous: sessionNous + breatherNous,
    sessionNous,
    breatherNous,
    lastMilestone: facts.lastMilestone ?? null,
    bottleneck: facts.bottleneck ?? (complete ? null : stop.reason),
    events: facts.events ?? [],
    trajectory: facts.trajectory ?? [],
    snapshots,
    achievements: facts.achievements ?? [],
    worldDiscoveries: facts.worldDiscoveries ?? [],
    worldDefeats: facts.worldDefeats ?? [],
    recovery: facts.recovery ?? null,
    eras: facts.eras ?? [openEra()],
    state,
    retention: "complete",
  };
}

// The artifact text a case feeds the app's import command — the same
// exported form a recorded run crosses sessions in, stamped at a fixed
// epoch so the constructed evidence stays byte-stable.
export function suppliedArtifact(facts: SuppliedRecordFacts = {}): string {
  const record = suppliedRecord(facts);
  return exportPlaythroughArtifact({
    record,
    ...(facts.modified ? { modified: facts.modified } : {}),
    ...(facts.interventions ? { interventions: facts.interventions } : {}),
    exportedAt: 0,
  });
}
