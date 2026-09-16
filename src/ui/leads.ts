// Charge rendering (ADR-0016, issue #41): patch leads and receiver light.
// The wire diagram is pure and testable — one lead per adjacent generator →
// receiver pair — while render.ts draws the markup and the stylesheet keeps
// every color in the token table. This module only decides geometry and the
// brightness curve.
import { CHARGE_RECEIVING_CATEGORIES, CATEGORY_OF } from "../engine/constants";
import { deployed, deployedGenerators, emittedStrength } from "../engine/economy";
import { adjacent } from "../engine/hex";
import type { GameState, ModuleInstance } from "../engine/types";

export interface ChargeLead {
  readonly generator: ModuleInstance;
  readonly receiver: ModuleInstance;
  // True only while the generator actually emits into live flow — a spent
  // charge window emits nothing, between sessions nothing flows at all
  // (ADR-0001). The renderer keys lead motion on it.
  readonly emitting: boolean;
}

// One patch lead per adjacent generator → receiver pair, drawn center-to-
// center and directional. The full potential wiring always comes back —
// live flow flags which leads emit, and everything else renders dim and
// static so disconnected output shows before the session starts
// (ADR-0002).
export function chargeLeads(state: GameState, live: boolean): ChargeLead[] {
  const leads: ChargeLead[] = [];
  const generators = deployedGenerators(state);
  for (const receiver of deployed(state)) {
    if (receiver.pos === null || !CHARGE_RECEIVING_CATEGORIES.includes(CATEGORY_OF[receiver.type])) continue;
    for (const generator of generators) {
      if (generator.pos === null || !adjacent(receiver.pos, generator.pos)) continue;
      leads.push({ generator, receiver, emitting: live && emittedStrength(state, generator, true) > 0 });
    }
  }
  return leads;
}

// Receiver brightening: received strength maps onto a 0..1 glow with the
// saturating shape of the empowerment curve. Strengths from multiple
// generators add before mapping, so every extra generator brightens the
// receiver further, with diminishing returns.
export function chargeGlow(strength: number): number {
  if (strength <= 0) return 0;
  return strength / (1 + strength);
}
