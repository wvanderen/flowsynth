// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createAppFixture } from "./testing/app-fixture";
import { makeRecorder } from "./testing/signal-recorder";
import { STORAGE_KEY, deserialize } from "../engine/save";
import { startSession } from "../engine/actions";
import { BALANCE } from "../engine/constants";

// The existing developer controls' regression evidence (#466): every quick
// control exercised in its legal state and in the states that must refuse
// it, with each control's save behavior pinned. The Focus scenario
// (app.focusscenario.test.ts) and the allocation board
// (app.capacity.test.ts) carry their own suites.
const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => fixture.release());

const status = (): string => document.getElementById("status")?.textContent ?? "";

function beginFlowWithPlan(target: number | null): void {
  app.state.sessionsCompleted = 1;
  startSession(app.state, target);
}

describe("the dev clock: flow-only time advancement (#466)", () => {
  it("refuses every mode but flow and leaves the state untouched", () => {
    app = boot(undefined, true);
    const nousBefore = app.state.nous;
    app.devAdvance(60);
    expect(status()).toBe("Dev clock only works during flow.");
    expect(app.state.mode).toBe("upgrade");
    expect(app.state.nous).toBe(nousBefore);
    expect(app.state.session).toBeNull();

    beginFlowWithPlan(600);
    app.pause();
    app.devAdvance(60);
    expect(status()).toBe("Dev clock only works during flow.");
    expect(app.state.mode).toBe("paused");
    expect(app.state.session!.elapsed).toBe(0);
  });

  it("in flow it advances the real seam: production, credited practice, and elapsed together", () => {
    app = boot(undefined, true);
    beginFlowWithPlan(600);
    const nousBefore = app.state.nous;
    app.devAdvance(60);
    expect(status()).toBe("Dev clock +60s.");
    expect(app.state.session!.elapsed).toBe(60);
    expect(app.state.session!.accounting.creditedSeconds).toBe(60);
    expect(app.state.session!.earned).toBeGreaterThan(0);
    expect(app.state.nous).toBeGreaterThan(nousBefore);
  });

  it("the panel's +1m button drives the same advance", () => {
    app = boot(undefined, true);
    beginFlowWithPlan(600);
    app.render();
    document.querySelector<HTMLButtonElement>('[data-dev="60"]')!.click();
    expect(status()).toBe("Dev clock +60s.");
    expect(app.state.session!.elapsed).toBe(60);
  });
});

describe("the timed-target jump (#466)", () => {
  it("refuses outside flow by naming the clock, and inside flow without a plan by naming the target", () => {
    app = boot(undefined, true);
    app.devToTarget();
    expect(status()).toBe("Dev clock only works during flow.");

    beginFlowWithPlan(null);
    app.devToTarget();
    expect(status()).toBe("No timed target running.");
    expect(app.state.session!.elapsed).toBe(0);
  });

  it("lands exactly on the target; the next wake-up fires the overrun signals", () => {
    const recorder = makeRecorder();
    app = boot(recorder.channels, true);
    beginFlowWithPlan(600);
    app.devToTarget();
    expect(status()).toBe("Dev clock +600s.");
    expect(app.state.session!.elapsed).toBe(600);
    // The jump owns the clock, not the signal: §4 gives the first timer
    // wake-up past the target the chime, the notification, and the flag.
    expect(app.state.session!.targetSignaled).toBe(false);
    app.tick();
    expect(app.state.session!.targetSignaled).toBe(true);
    expect(recorder.fired.chimes).toBe(1);
    expect(recorder.fired.notifications).toBe(1);
    // A jump with nothing left to cross is a no-op, never a rewind.
    app.devToTarget();
    expect(status()).toBe("Dev clock +0s.");
    expect(app.state.session!.elapsed).toBe(600);
  });
});

describe("the +100ν quick grant (ADR-0077's live-save tier, #466)", () => {
  it("credits the one seam and lands in the ordinary save at once — a reload keeps it", () => {
    app = boot(undefined, true);
    const nousBefore = app.state.nous;
    const totalBefore = app.state.totalEarned;
    const eraBefore = app.state.eraEarned;
    app.devNous();
    expect(status()).toBe("Dev: +100 ν.");
    expect(app.state.nous).toBe(nousBefore + 100);
    expect(app.state.totalEarned).toBe(totalBefore + 100);
    expect(app.state.eraEarned).toBe(eraBefore + 100);
    // The quick grants' tier is the live save: the write lands now, not
    // whenever the next action saves — the contrast that keeps the tier
    // distinct from the Focus scenario's isolated slot.
    expect(deserialize(localStorage.getItem(STORAGE_KEY)!).state!.totalEarned).toBe(totalBefore + 100);
    const revived = boot(undefined, true);
    expect(revived.state.totalEarned).toBe(totalBefore + 100);
  });
});

describe("the World era grant (#466)", () => {
  it("refuses while a session is live and leaves the session and the save untouched", () => {
    app = boot(undefined, true);
    beginFlowWithPlan(600);
    app.devAdvance(120);
    const slotBefore = localStorage.getItem(STORAGE_KEY);
    app.devWorldEra();
    expect(status()).toBe("World era needs upgrade mode — end the running session or breather first.");
    expect(app.state.mode).toBe("flow");
    expect(app.state.session!.elapsed).toBe(120);
    expect(app.state.world.weapons).toHaveLength(0);
    expect(app.state.world.columns).toHaveLength(0);
    expect(app.ui.boardLayer).not.toBe("world");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(slotBefore);

    app.endFlow();
    document.getElementById("summary-continue")!.click();
    expect(app.state.mode).toBe("upgrade");
    app.devWorldEra();
    expect(app.state.world.weapons).toHaveLength(2);
  });

  it("in upgrade mode it grants the era and saves it: a reload returns the same era", () => {
    app = boot(undefined, true);
    app.devWorldEra();
    expect(status()).toBe("Dev: World era granted — the second face stands.");
    expect(app.state.prestiges).toBe(1);
    expect(app.state.catalogEntryOwned).toBe(true);
    expect(app.state.arete).toBe(20);
    expect(app.state.eraEarned).toBe(BALANCE.world.entryNous * 1.5);
    expect(app.ui.boardLayer).toBe("world");
    expect(app.state.world.weapons.filter((w) => w.pos !== null)).toHaveLength(1);
    expect(app.state.world.weapons.filter((w) => w.pos === null)).toHaveLength(1);
    expect(app.state.world.columns.filter((c) => c.pos !== null)).toHaveLength(1);
    expect(app.state.world.columns.filter((c) => c.pos === null)).toHaveLength(1);
    const stored = deserialize(localStorage.getItem(STORAGE_KEY)!).state!;
    expect(stored.world.weapons).toHaveLength(2);
    expect(stored.world.columns).toHaveLength(2);
    const revived = boot(undefined, true);
    expect(revived.state.prestiges).toBe(1);
    expect(revived.state.world.weapons).toHaveLength(2);
  });
});

describe("the dev gating contract (#466)", () => {
  it("a normal instrument ignores every dev helper", () => {
    app = boot();
    const before = app.state;
    app.devAdvance(60);
    app.devToTarget();
    app.devNous();
    app.devSynth();
    app.devWorldEra();
    app.devFocusScenario();
    app.devToggleBoard();
    expect(app.state).toBe(before);
    expect(app.state.session).toBeNull();
    expect(app.devBoard).toBeNull();
    expect(app.devFocusScenarioNote).toBeNull();
  });
});
