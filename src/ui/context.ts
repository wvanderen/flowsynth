// The render context: what every region module receives instead of the App
// itself. Writes cross the seam only as intents (the player-verb interface
// App implements); reads arrive as state and ui; the memo carries the
// derivations multiple regions would otherwise each recompute per pass.
import { computeRates, wholeNous } from "../engine/economy";
import { BALANCE } from "../engine/constants";
import { practiceCountdown } from "./format";
import type { GameState, RateSnapshot } from "../engine/types";
import type { HonestyOutcome } from "../engine/trust";
import type { App, ModalKind, UiState } from "./app";

// The write path across the render seam — player verbs, not a mirror of
// App's methods. Grouped by the region that fires them; App implements the
// whole list (structurally: this is the type App satisfies).
export interface UiIntents {
  // ── modal shell ────────────────────────────────────────────────────────
  openModal(kind: ModalKind): void;
  closeModal(): void;
  /** One Escape state machine: modal → placing → buying → arranging → popover → selection. */
  escape(): void;

  // ── session entry and close-out ────────────────────────────────────────
  /** Sets the next session's planned target; null is open-ended. */
  planTarget(target: number | null): void;
  beginFlow(habitId: string | null): void;
  beginFlowNewHabit(name: string): void;
  resolveHonesty(outcome: HonestyOutcome): void;
  dismissSummary(): void;
  recordReflectionText(text: string): void;
  recordReflectionSlider(position: number): void;

  // ── catalog and forge rolls ────────────────────────────────────────────
  buyShelf(type: keyof typeof BALANCE.shelfPrices): void;
  armCellPurchase(): void;
  chooseCandidate(offerId: string, candidateId: string): void;

  // ── settings and save ──────────────────────────────────────────────────
  setMuted(muted: boolean): void;
  importText(text: string): boolean;
  hardReset(): void;
  /** The save file's serialized text — the one query the shell needs from persistence. */
  exportText(): string;

  // ── status monitor ─────────────────────────────────────────────────────
  acknowledgeHorizon(): void;

  // ── voice ──────────────────────────────────────────────────────────────
  say(message: string): void;
  /** Region-local view state changed; run a render pass. */
  refreshView(): void;
}

export interface RenderContext {
  readonly state: GameState;
  readonly ui: UiState;
  readonly intents: UiIntents;
  // True while the honesty report frames itself as the pre-exit gate.
  readonly exitPending: boolean;
  // Lazily-memoized shared derivations, computed at most once per render
  // pass no matter how many regions read them.
  readonly memo: {
    /** The board's projected charged rate — the countdown basis (§7). */
    projected(): RateSnapshot;
    /** The board's current snapshot at its own flow default. */
    snapshot(): RateSnapshot;
  };
}

export function contextFor(app: App): RenderContext {
  const { state } = app;
  let projected: RateSnapshot | null = null;
  let snapshot: RateSnapshot | null = null;
  return {
    state,
    ui: app.ui,
    intents: app,
    exitPending: app.exitPending,
    memo: {
      projected: () => (projected ??= computeRates(state, true)),
      snapshot: () => (snapshot ??= computeRates(state)),
    },
  };
}

// The practice-minute countdown on upgrade-mode purchase surfaces (§7),
// read off the memoized projection so every surface quotes the same basis.
export function projectedCountdown(ctx: RenderContext, cost: number): string | null {
  return practiceCountdown(cost, wholeNous(ctx.state), ctx.memo.projected().rate);
}
