import { allocateRates } from "./economy";
import { createInitialState, createModule } from "./state";
import type { AllocationRead } from "./allocation";
import type { GameState, ModuleType, RateSnapshot } from "./types";

// The development board's scenario (issue #257): a fixed, deterministic
// board — two disconnected formations, a doubled pitch class, a shared
// silent voice, a local booster, and a generator holding charge — so
// capacity changes, power changes, and placement changes all visibly move
// the allocation through the real rate path. Development-only: nothing
// here touches the production game, and the scenario never persists.

export function createDevScenario(): GameState {
  // A minimal GameState shell: the scenario rides the real rate pass,
  // which reads modules, cells, mutators, habits, and ledgers only.
  const state = createInitialState();
  state.modules = [];
  state.cells = [];
  const add = (type: ModuleType, q: number, r: number, level = 0): string => {
    const module = createModule(state, type, "common");
    module.level = level;
    module.pos = { q, r };
    state.modules.push(module);
    state.cells.push({ q, r });
    return module.id;
  };
  // Formation one: C·G adjacent, the E column bridged by spacers, a
  // doubled E class, the harmonizer singing G into both, a booster beside
  // the C·G pair, and a focus generator holding a charged reserve over
  // the C voice.
  add("additive", 0, 0, 2); // C4
  add("additive", 1, 0, 0); // G4
  add("additive", 4, 0, 1); // E4
  add("additive", 4, 1, 0); // E5 — the doubled class
  add("harmonizer", 1, 1, 2); // sings G4
  add("infusor", 0, 1, 1);
  const generator = createModule(state, "focusKeyed", "common");
  generator.level = 1;
  generator.pos = { q: -1, r: 0 };
  generator.reserve = 3600;
  state.modules.push(generator);
  state.cells.push({ q: -1, r: 0 });
  add("spacer", 2, 0);
  add("spacer", 3, 0);
  // Formation two: a disconnected dyad a register up, with two free cells
  // beside it — the placement levers.
  add("additive", -1, 3, 1);
  add("additive", 0, 3, 0);
  state.cells.push({ q: 1, r: 3 });
  state.cells.push({ q: 2, r: 3 });
  return state;
}

// The development board's result: the allocated snapshot plus the raw
// solver read the board's rows and stress table inspect.
export interface DevBoardResult {
  snapshot: RateSnapshot;
  read: AllocationRead;
}

// The development board's one computation: the same authoritative
// two-pass the live game runs (economy.allocateRates — chordless weights
// through the real engine, whole-chord allocation against them, then the
// allocated analysis riding the same real engine), with the board's
// configurable capacity and retention hint threaded through. The returned
// allocation's keys feed the next call's hint.
export function allocatedDevScenarioRates(
  scenario: GameState,
  capacity: number,
  keep: ReadonlySet<string> | null,
): DevBoardResult {
  return allocateRates(scenario, true, { capacity, ...(keep ? { keep } : {}) });
}
