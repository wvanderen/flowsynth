import { EPS } from "./constants";
import type { GameState, GeneratorType } from "./types";

// The console fact's credit (ADR-0047): a fact of the matching generator
// type grows every owned generator's reserve, board or tray alike — one
// seam for the note and goal credits, so the two facts can never drift in
// whom they credit or by how much. Copy-count multiplication is deliberate
// strategy: copies bank more reservoir, not just reach. Reserves are
// charge state — they burn 1 s/s in flow (advance.ts), reset at prestige,
// and the consumed module's unspent reserve is forfeited on combination.
export function creditOwnedGenerators(state: GameState, type: GeneratorType, seconds: number): void {
  if (!(seconds > EPS)) return;
  for (const module of state.modules) {
    if (module.type === type) module.reserve += seconds;
  }
}
